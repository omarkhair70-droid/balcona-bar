import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuditAction,
  AuditActorType,
  MerchantPaymentIntegrationEnvironment,
  MerchantPaymentIntegrationStatus,
  OnlinePaymentProvider,
  Prisma,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertMerchantPaymentIntegrationDto } from "./dto/merchant-payment-integration.dto";
import { paymentProviderCapabilities } from "./providers/payment-provider-capabilities";
import { ProviderRuntimeContext } from "./providers/payment-provider.types";

const SECRET_REFERENCE_PATTERN = /^[A-Z][A-Z0-9_]{2,127}$/;
const SENSITIVE_KEY_PATTERN =
  /(secret|password|private|api[_-]?key|token|hmac)/i;

const READY_CHANNELS: Partial<Record<OnlinePaymentProvider, string[]>> = {
  [OnlinePaymentProvider.paymob]: ["card"],
  [OnlinePaymentProvider.fawry]: ["card", "wallet", "reference_code", "valu"],
};

export type MerchantIntegrationResolution = {
  id: string | null;
  companyId: string;
  branchId: string | null;
  provider: OnlinePaymentProvider;
  environment: MerchantPaymentIntegrationEnvironment;
  enabledChannels: string[];
  merchantAccountReference: string | null;
  configurationMetadata: Record<string, unknown>;
  secretReferences: Record<string, string>;
  webhookConfigured: boolean;
  recoveryReady: boolean;
  settlementConfigured: boolean;
  legacyRuntimeFallback: boolean;
};

@Injectable()
export class MerchantPaymentIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async listForBranch(branchId: string) {
    const branch = await this.requireBranch(branchId);
    const integrations = await this.prisma.merchantPaymentIntegration.findMany({
      where: {
        companyId: branch.companyId,
        OR: [{ branchId }, { branchId: null }],
      },
      orderBy: [
        { branchId: "desc" },
        { priority: "asc" },
        { createdAt: "asc" },
      ],
    });

    const effective = await this.resolveForScope(
      branch.companyId,
      branchId,
      false,
    );

    return {
      branch,
      integrations: integrations.map((integration) =>
        this.toStaffResult(integration),
      ),
      effective: {
        id: effective.id,
        companyId: effective.companyId,
        branchId: effective.branchId,
        provider: effective.provider,
        environment: effective.environment,
        enabledChannels: effective.enabledChannels,
        merchantAccountReference: effective.merchantAccountReference,
        legacyRuntimeFallback: effective.legacyRuntimeFallback,
      },
    };
  }

  async upsertForBranch(
    branchId: string,
    staffUserId: string,
    body: UpsertMerchantPaymentIntegrationDto,
  ) {
    const branch = await this.requireBranch(branchId);
    this.assertSafeConfiguration(body.configurationMetadata ?? {});
    const secretReferences = this.normalizeSecretReferences(
      body.secretReferences ?? {},
    );
    const enabledChannels = this.normalizeChannels(
      body.provider,
      body.enabledChannels,
    );
    const scopedBranchId = body.scope === "branch" ? branchId : null;
    const scopeKey = [
      branch.companyId,
      scopedBranchId ?? "company",
      body.provider,
    ].join(":");
    const previous = await this.prisma.merchantPaymentIntegration.findUnique({
      where: { scopeKey },
    });

    const readiness = this.evaluateReadiness({
      ...body,
      merchantAccountReference: this.optionalText(
        body.merchantAccountReference,
      ),
      enabledChannels,
      configurationMetadata: body.configurationMetadata ?? {},
      secretReferences,
    });

    if (
      body.status === MerchantPaymentIntegrationStatus.ready &&
      !readiness.ready
    ) {
      throw new BadRequestException(readiness.message);
    }

    const integration = await this.prisma.merchantPaymentIntegration.upsert({
      where: { scopeKey },
      create: {
        scopeKey,
        companyId: branch.companyId,
        branchId: scopedBranchId,
        provider: body.provider,
        environment: body.environment,
        status: body.status,
        priority: body.priority ?? 100,
        merchantAccountReference: this.optionalText(
          body.merchantAccountReference,
        ),
        enabledChannels,
        configurationMetadata: this.toJson(body.configurationMetadata ?? {}),
        secretReferences: this.toJson(secretReferences),
        readinessMessage: readiness.message,
        webhookConfigured: body.webhookConfigured,
        recoveryReady: body.recoveryReady,
        settlementConfigured: body.settlementConfigured,
        lastValidatedAt: readiness.ready ? new Date() : null,
      },
      update: {
        environment: body.environment,
        status: body.status,
        priority: body.priority ?? 100,
        merchantAccountReference: this.optionalText(
          body.merchantAccountReference,
        ),
        enabledChannels,
        configurationMetadata: this.toJson(body.configurationMetadata ?? {}),
        secretReferences: this.toJson(secretReferences),
        readinessMessage: readiness.message,
        webhookConfigured: body.webhookConfigured,
        recoveryReady: body.recoveryReady,
        settlementConfigured: body.settlementConfigured,
        lastValidatedAt: readiness.ready ? new Date() : null,
      },
    });

    await this.auditService.recordAuditLog({
      companyId: branch.companyId,
      branchId: scopedBranchId ?? branchId,
      actorType: AuditActorType.staff,
      actorStaffUserId: staffUserId,
      targetType: "merchant_payment_integration",
      targetId: integration.id,
      action: AuditAction.other,
      message: previous
        ? "Merchant payment integration updated"
        : "Merchant payment integration created",
      before: previous ? this.toStaffResult(previous) : undefined,
      after: this.toStaffResult(integration),
    });

    return this.toStaffResult(integration);
  }

  async customerCapabilities(sessionId: string, billId: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        currency: true,
      },
    });

    if (!bill || bill.tableSessionId !== sessionId) {
      throw new NotFoundException("Bill not found for this table session");
    }

    const resolution = await this.resolveForScope(
      bill.companyId,
      bill.branchId,
      true,
    );
    const capabilities = paymentProviderCapabilities(resolution.provider);

    return {
      provider: resolution.provider,
      environment: resolution.environment,
      status: "ready",
      enabledChannels: resolution.enabledChannels,
      requiresBillingData:
        resolution.provider === OnlinePaymentProvider.paymob ||
        resolution.provider === OnlinePaymentProvider.fawry,
      capabilities,
      hostedMethods: this.hostedMethods(
        resolution.provider,
        resolution.enabledChannels,
      ),
      liveVerified: false,
    };
  }

  async resolveForScope(
    companyId: string,
    branchId: string,
    failClosed: boolean,
  ): Promise<MerchantIntegrationResolution> {
    const delegate = this.prisma.merchantPaymentIntegration;
    const integration = delegate
      ? await delegate.findFirst({
          where: {
            companyId,
            status: MerchantPaymentIntegrationStatus.ready,
            OR: [{ branchId }, { branchId: null }],
          },
          orderBy: [
            { branchId: "desc" },
            { priority: "asc" },
            { createdAt: "asc" },
          ],
        })
      : null;

    if (integration) {
      const resolution = this.toResolution(integration);
      const readiness = this.evaluateReadiness(resolution);

      if (!readiness.ready) {
        throw new ServiceUnavailableException(readiness.message);
      }

      return resolution;
    }

    const configuredProvider = this.configuredProvider();
    const appEnvironment =
      this.configService.get<string>("app.environment") ?? "development";

    if (
      configuredProvider !== OnlinePaymentProvider.mock &&
      (failClosed || appEnvironment === "production")
    ) {
      throw new ServiceUnavailableException(
        "Merchant payment integration is not ready for this venue",
      );
    }

    return {
      id: null,
      companyId,
      branchId,
      provider: configuredProvider,
      environment:
        appEnvironment === "production"
          ? MerchantPaymentIntegrationEnvironment.live
          : MerchantPaymentIntegrationEnvironment.test,
      enabledChannels:
        READY_CHANNELS[configuredProvider] ??
        (configuredProvider === OnlinePaymentProvider.mock ? ["mock"] : []),
      merchantAccountReference: null,
      configurationMetadata: {},
      secretReferences: {},
      webhookConfigured: true,
      recoveryReady: true,
      settlementConfigured: false,
      legacyRuntimeFallback: true,
    };
  }

  async runtimeContextForIntent(
    intentId: string,
    expectedProvider?: OnlinePaymentProvider,
  ): Promise<ProviderRuntimeContext | undefined> {
    const intent = await this.prisma.onlinePaymentIntent.findUnique({
      where: { id: intentId },
      select: {
        companyId: true,
        branchId: true,
        provider: true,
        merchantPaymentIntegration: true,
      },
    });

    if (!intent) {
      throw new NotFoundException("Online payment intent not found");
    }
    if (expectedProvider && intent.provider !== expectedProvider) {
      throw new BadRequestException("Payment provider scope does not match");
    }
    return this.runtimeContextFromBoundIntent(intent);
  }

  async runtimeContextForProviderOrder(
    provider: OnlinePaymentProvider,
    providerOrderId: string,
  ): Promise<ProviderRuntimeContext | undefined> {
    const intent = await this.prisma.onlinePaymentIntent.findUnique({
      where: {
        provider_providerOrderId: { provider, providerOrderId },
      },
      select: {
        companyId: true,
        branchId: true,
        provider: true,
        merchantPaymentIntegration: true,
      },
    });

    if (!intent) {
      return undefined;
    }
    return this.runtimeContextFromBoundIntent(intent);
  }

  private evaluateReadiness(input: {
    provider: OnlinePaymentProvider;
    environment: MerchantPaymentIntegrationEnvironment;
    merchantAccountReference?: string | null;
    enabledChannels: string[];
    configurationMetadata?: Record<string, unknown>;
    secretReferences?: Record<string, string>;
    webhookConfigured?: boolean;
    recoveryReady?: boolean;
  }) {
    if (input.provider === OnlinePaymentProvider.mock) {
      return {
        ready: true,
        message: "Mock provider is available only outside production",
      };
    }

    if (
      input.provider === OnlinePaymentProvider.maestr ||
      input.provider === OnlinePaymentProvider.external
    ) {
      return {
        ready: false,
        message:
          "Provider execution is blocked until the verified merchant contract is configured",
      };
    }

    if (!input.merchantAccountReference) {
      return {
        ready: false,
        message: "Merchant account reference is required",
      };
    }

    if (input.enabledChannels.length === 0) {
      return {
        ready: false,
        message: "At least one verified payment channel is required",
      };
    }

    const refs = input.secretReferences ?? {};
    const requiredRefs =
      input.provider === OnlinePaymentProvider.paymob
        ? ["secretKey", "apiKey", "hmacSecret"]
        : ["secureKey"];

    for (const key of requiredRefs) {
      const reference = refs[key];
      if (!reference || !this.configService.get<string>(reference)) {
        return {
          ready: false,
          message: `Runtime secret reference ${key} is not configured`,
        };
      }
    }

    if (!input.webhookConfigured) {
      return { ready: false, message: "Provider webhook is not configured" };
    }

    if (!input.recoveryReady) {
      return {
        ready: false,
        message: "Provider inquiry/recovery is not ready",
      };
    }

    if (
      (this.configService.get<string>("app.environment") ?? "development") ===
        "production" &&
      input.environment !== MerchantPaymentIntegrationEnvironment.live
    ) {
      return {
        ready: false,
        message: "Production requires a live merchant integration",
      };
    }

    return { ready: true, message: "Merchant integration is software-ready" };
  }

  private runtimeContextFromBoundIntent(intent: {
    companyId: string;
    branchId: string;
    provider: OnlinePaymentProvider;
    merchantPaymentIntegration: {
      id: string;
      companyId: string;
      branchId: string | null;
      provider: OnlinePaymentProvider;
      environment: MerchantPaymentIntegrationEnvironment;
      status: MerchantPaymentIntegrationStatus;
      enabledChannels: string[];
      merchantAccountReference: string | null;
      configurationMetadata: Prisma.JsonValue | null;
      secretReferences: Prisma.JsonValue | null;
      webhookConfigured: boolean;
      recoveryReady: boolean;
      settlementConfigured: boolean;
    } | null;
  }): ProviderRuntimeContext | undefined {
    const integration = intent.merchantPaymentIntegration;
    const appEnvironment =
      this.configService.get<string>("app.environment") ?? "development";

    if (!integration) {
      if (appEnvironment === "production") {
        throw new ServiceUnavailableException(
          "Payment intent is not bound to a tenant merchant integration",
        );
      }
      return undefined;
    }

    if (
      integration.companyId !== intent.companyId ||
      (integration.branchId !== null &&
        integration.branchId !== intent.branchId) ||
      integration.provider !== intent.provider ||
      integration.status !== MerchantPaymentIntegrationStatus.ready
    ) {
      throw new ServiceUnavailableException(
        "Payment intent merchant scope is invalid or no longer ready",
      );
    }

    const resolution = this.toResolution(integration);
    const readiness = this.evaluateReadiness(resolution);
    if (!readiness.ready) {
      throw new ServiceUnavailableException(readiness.message);
    }

    return {
      integrationId: integration.id,
      environment: integration.environment,
      merchantAccountReference: integration.merchantAccountReference,
      enabledChannels: integration.enabledChannels,
      configurationMetadata: resolution.configurationMetadata,
      secretReferences: resolution.secretReferences,
    };
  }

  private toResolution(integration: {
    id: string;
    companyId: string;
    branchId: string | null;
    provider: OnlinePaymentProvider;
    environment: MerchantPaymentIntegrationEnvironment;
    enabledChannels: string[];
    merchantAccountReference: string | null;
    configurationMetadata: Prisma.JsonValue | null;
    secretReferences: Prisma.JsonValue | null;
    webhookConfigured: boolean;
    recoveryReady: boolean;
    settlementConfigured?: boolean;
  }): MerchantIntegrationResolution {
    return {
      id: integration.id,
      companyId: integration.companyId,
      branchId: integration.branchId,
      provider: integration.provider,
      environment: integration.environment,
      enabledChannels: integration.enabledChannels,
      merchantAccountReference: integration.merchantAccountReference,
      configurationMetadata: this.jsonRecord(integration.configurationMetadata),
      secretReferences: this.normalizeSecretReferences(
        this.jsonRecord(integration.secretReferences),
      ),
      webhookConfigured: integration.webhookConfigured,
      recoveryReady: integration.recoveryReady,
      settlementConfigured: integration.settlementConfigured ?? false,
      legacyRuntimeFallback: false,
    };
  }

  private toStaffResult(integration: {
    secretReferences: Prisma.JsonValue | null;
    configurationMetadata: Prisma.JsonValue | null;
    [key: string]: unknown;
  }) {
    const { secretReferences, configurationMetadata, ...fields } = integration;
    return {
      ...fields,
      configurationMetadata: this.jsonRecord(configurationMetadata),
      secretReferenceKeys: Object.keys(this.jsonRecord(secretReferences)),
      capabilities: paymentProviderCapabilities(
        fields.provider as OnlinePaymentProvider,
      ),
    };
  }

  private normalizeSecretReferences(value: Record<string, unknown>) {
    const normalized: Record<string, string> = {};

    for (const [key, reference] of Object.entries(value)) {
      if (
        typeof reference !== "string" ||
        !SECRET_REFERENCE_PATTERN.test(reference)
      ) {
        throw new BadRequestException(
          `Secret reference ${key} must be an environment variable name, not a secret value`,
        );
      }
      normalized[key] = reference;
    }

    return normalized;
  }

  private assertSafeConfiguration(
    value: unknown,
    path = "configurationMetadata",
  ) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new BadRequestException(
          `${path}.${key} may not contain provider secrets; use secretReferences`,
        );
      }
      if (child && typeof child === "object") {
        this.assertSafeConfiguration(child, `${path}.${key}`);
      }
    }
  }

  private normalizeChannels(
    provider: OnlinePaymentProvider,
    channels: string[],
  ) {
    const allowed = READY_CHANNELS[provider] ?? [];
    const normalized = [
      ...new Set(channels.map((channel) => channel.trim().toLowerCase())),
    ].filter(Boolean);
    const unsupported = normalized.filter(
      (channel) => !allowed.includes(channel),
    );
    if (unsupported.length > 0) {
      throw new BadRequestException(
        `Unsupported ${provider} payment channel: ${unsupported.join(", ")}`,
      );
    }
    return normalized;
  }

  private hostedMethods(provider: OnlinePaymentProvider, channels: string[]) {
    if (provider !== OnlinePaymentProvider.fawry) {
      return channels;
    }
    const mapping: Record<string, string> = {
      card: "CARD",
      wallet: "MWALLET",
      reference_code: "PayAtFawry",
      valu: "VALU",
    };
    return channels.map((channel) => mapping[channel]).filter(Boolean);
  }

  private configuredProvider() {
    const provider = this.configService.get<string>("onlinePayments.provider");
    return Object.values(OnlinePaymentProvider).includes(
      provider as OnlinePaymentProvider,
    )
      ? (provider as OnlinePaymentProvider)
      : OnlinePaymentProvider.mock;
  }

  private async requireBranch(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        companyId: true,
        name: true,
        slug: true,
        status: true,
      },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    return branch;
  }

  private optionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private jsonRecord(value: Prisma.JsonValue | null | undefined) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
