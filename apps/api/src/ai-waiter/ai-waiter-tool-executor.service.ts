import { Injectable, Logger } from "@nestjs/common";
import {
  AiWaiterToolCallStatus,
  AiWaiterToolName,
  WaiterCallType,
} from "@prisma/client";
import { BillRequestsService } from "../bill-requests/bill-requests.service";
import { WaiterCallsService } from "../waiter-calls/waiter-calls.service";
import {
  AiWaiterContext,
  AiWaiterProviderResult,
  AiWaiterProviderToolCall,
} from "./ai-waiter.types";

type ExecutionInput = {
  context: AiWaiterContext;
  customerMessage: string;
  providerResult: AiWaiterProviderResult;
};

const EXPLICIT_WAITER_WORDS = [
  "waiter",
  "human",
  "staff",
  "server",
  "help",
  "complaint",
  "problem",
  "wrong",
  "late",
  "cold",
  "ويتر",
  "جرسون",
  "ستاف",
  "مساعدة",
  "ساعد",
  "نادي",
  "اكلم",
  "أكلم",
  "مشكلة",
  "غلط",
  "اتأخر",
  "بارد",
  "مش عاجب",
];
const SERVICE_PROBLEM_WORDS = [
  "complaint",
  "problem",
  "wrong",
  "late",
  "cold",
  "مشكلة",
  "غلط",
  "اتأخر",
  "بارد",
  "مش عاجب",
];

@Injectable()
export class AiWaiterToolExecutorService {
  private readonly logger = new Logger(AiWaiterToolExecutorService.name);

  constructor(
    private readonly billRequestsService: BillRequestsService,
    private readonly waiterCallsService: WaiterCallsService,
  ) {}

  async execute(input: ExecutionInput): Promise<AiWaiterProviderResult> {
    const toolCalls = this.withInferredToolCalls(input);
    const executedToolCalls: AiWaiterProviderToolCall[] = [];

    for (const toolCall of toolCalls) {
      if (toolCall.toolName === AiWaiterToolName.read_order_status) {
        executedToolCalls.push(this.readOrderStatus(input, toolCall));
        continue;
      }

      if (toolCall.toolName === AiWaiterToolName.request_bill) {
        executedToolCalls.push(await this.requestBill(input, toolCall));
        continue;
      }

      if (toolCall.toolName === AiWaiterToolName.call_waiter) {
        executedToolCalls.push(await this.callWaiter(input, toolCall));
        continue;
      }

      executedToolCalls.push(toolCall);
    }

    return {
      ...input.providerResult,
      toolCalls: executedToolCalls,
      metadata: {
        ...(input.providerResult.metadata ?? {}),
        toolExecution: this.executionSummary(executedToolCalls),
      },
    };
  }

  private withInferredToolCalls(input: ExecutionInput) {
    const toolCalls = [...input.providerResult.toolCalls];
    const names = new Set(toolCalls.map((toolCall) => toolCall.toolName));
    const intent =
      typeof input.providerResult.metadata?.intent === "string"
        ? input.providerResult.metadata.intent
        : "";

    if (intent === "order_status" && !names.has(AiWaiterToolName.read_order_status)) {
      toolCalls.push({
        toolName: AiWaiterToolName.read_order_status,
        status: AiWaiterToolCallStatus.pending,
        input: { inferredFrom: "intent" },
      });
    }

    if (intent === "request_bill" && !names.has(AiWaiterToolName.request_bill)) {
      toolCalls.push({
        toolName: AiWaiterToolName.request_bill,
        status: AiWaiterToolCallStatus.pending,
        input: { inferredFrom: "intent" },
      });
    }

    if (
      this.shouldInferWaiterCall(input) &&
      !names.has(AiWaiterToolName.call_waiter)
    ) {
      toolCalls.push({
        toolName: AiWaiterToolName.call_waiter,
        status: AiWaiterToolCallStatus.pending,
        input: { inferredFrom: "intent" },
      });
    }

    return toolCalls;
  }

  private readOrderStatus(
    input: ExecutionInput,
    toolCall: AiWaiterProviderToolCall,
  ): AiWaiterProviderToolCall {
    const orders = input.context.operationalContext?.orders;
    const latest = orders?.latest;

    if (!latest) {
      return {
        ...toolCall,
        status: AiWaiterToolCallStatus.skipped,
        output: {
          reason: "no_orders_for_table_session",
          activeCount: orders?.activeCount ?? 0,
        },
      };
    }

    return {
      ...toolCall,
      status: AiWaiterToolCallStatus.succeeded,
      output: {
        activeCount: orders?.activeCount ?? 0,
        latestOrder: {
          id: latest.id,
          orderNumber: latest.orderNumber,
          status: latest.status,
          customerStatus: latest.customerStatus,
          submittedAt: latest.submittedAt,
          acceptedAt: latest.acceptedAt,
          readyAt: latest.readyAt,
          servedAt: latest.servedAt,
          completedAt: latest.completedAt,
          itemCount: latest.itemCount,
          preparationSummary: latest.preparationSummary,
        },
      },
    };
  }

  private async requestBill(
    input: ExecutionInput,
    toolCall: AiWaiterProviderToolCall,
  ): Promise<AiWaiterProviderToolCall> {
    const bill = input.context.operationalContext?.bill;

    if (input.context.operationalContext?.branchOps?.billFlowEnabled === false) {
      return this.skipped(toolCall, "bill_flow_disabled");
    }

    if (bill?.activeBillRequestId) {
      return this.skipped(toolCall, "active_bill_request_exists", {
        activeBillRequestId: bill.activeBillRequestId,
        activeBillRequestStatus: bill.activeBillRequestStatus,
      });
    }

    if (!bill?.hasBillableOrders) {
      return this.skipped(toolCall, "no_billable_orders");
    }

    try {
      const result = await this.billRequestsService.requestBill(
        input.context.tableSession.id,
        {
          note: this.truncate(input.customerMessage, 500),
        },
      );
      const billRequest = this.record(result.billRequest) ?? this.record(result);

      return {
        ...toolCall,
        status: AiWaiterToolCallStatus.succeeded,
        input: {
          ...(this.record(toolCall.input) ?? {}),
          source: "ai_waiter",
        },
        output: {
          billRequestId: this.stringValue(billRequest?.id),
          status: this.stringValue(billRequest?.status, "open"),
        },
      };
    } catch (error) {
      this.logToolError(AiWaiterToolName.request_bill, error);

      return this.failed(toolCall, error);
    }
  }

  private async callWaiter(
    input: ExecutionInput,
    toolCall: AiWaiterProviderToolCall,
  ): Promise<AiWaiterProviderToolCall> {
    const waiterCalls = input.context.operationalContext?.waiterCalls;

    if (input.context.operationalContext?.branchOps?.waiterCallsEnabled === false) {
      return this.skipped(toolCall, "waiter_calls_disabled");
    }

    if (waiterCalls?.activeCount && waiterCalls.activeCount > 0) {
      return this.skipped(toolCall, "active_waiter_call_exists", {
        activeWaiterCallId: waiterCalls.latest?.id,
        activeWaiterCallStatus: waiterCalls.latest?.status,
      });
    }

    if (!this.isExplicitWaiterRequest(input)) {
      return this.skipped(toolCall, "waiter_call_not_explicit");
    }

    const isProblem = this.isServiceProblem(input);

    try {
      const result = await this.waiterCallsService.createForTableSession(
        input.context.tableSession.id,
        {
          type: isProblem
            ? WaiterCallType.order_problem
            : WaiterCallType.call_waiter,
          priority: isProblem ? 2 : 1,
          message: this.truncate(input.customerMessage, 500),
        },
      );
      const resultRecord = this.record(result);
      const waiterCall =
        this.record(resultRecord?.waiterCall) ??
        this.record(resultRecord?.call) ??
        resultRecord;

      return {
        ...toolCall,
        status: AiWaiterToolCallStatus.succeeded,
        input: {
          ...(this.record(toolCall.input) ?? {}),
          source: "ai_waiter",
          type: isProblem
            ? WaiterCallType.order_problem
            : WaiterCallType.call_waiter,
          priority: isProblem ? 2 : 1,
        },
        output: {
          waiterCallId: this.stringValue(waiterCall?.id),
          status: this.stringValue(waiterCall?.status, "open"),
          priority: isProblem ? 2 : 1,
        },
      };
    } catch (error) {
      this.logToolError(AiWaiterToolName.call_waiter, error);

      return this.failed(toolCall, error);
    }
  }

  private shouldInferWaiterCall(input: ExecutionInput) {
    const intent =
      typeof input.providerResult.metadata?.intent === "string"
        ? input.providerResult.metadata.intent
        : "";

    if (
      intent !== "call_waiter" &&
      intent !== "complaint" &&
      intent !== "service_problem"
    ) {
      return false;
    }

    return this.isExplicitWaiterRequest(input) || this.isServiceProblem(input);
  }

  private isExplicitWaiterRequest(input: ExecutionInput) {
    const normalized = input.customerMessage.toLocaleLowerCase("ar-EG");

    return EXPLICIT_WAITER_WORDS.some((word) =>
      normalized.includes(word.toLocaleLowerCase("ar-EG")),
    );
  }

  private isServiceProblem(input: ExecutionInput) {
    const normalized = input.customerMessage.toLocaleLowerCase("ar-EG");

    return (
      SERVICE_PROBLEM_WORDS.some((word) =>
        normalized.includes(word.toLocaleLowerCase("ar-EG")),
      ) ||
      input.providerResult.metadata?.intent === "complaint" ||
      input.providerResult.metadata?.intent === "service_problem"
    );
  }

  private executionSummary(toolCalls: AiWaiterProviderToolCall[]) {
    const actionableToolNames = new Set<AiWaiterToolName>([
        AiWaiterToolName.read_order_status,
        AiWaiterToolName.request_bill,
        AiWaiterToolName.call_waiter,
    ]);
    const actionCalls = toolCalls.filter((toolCall) =>
      actionableToolNames.has(toolCall.toolName),
    );

    return {
      refreshCustomerState: actionCalls.some(
        (toolCall) =>
          toolCall.status === AiWaiterToolCallStatus.succeeded ||
          toolCall.status === AiWaiterToolCallStatus.skipped,
      ),
      actions: actionCalls.map((toolCall) => ({
        toolName: toolCall.toolName,
        status: toolCall.status ?? AiWaiterToolCallStatus.succeeded,
        output: toolCall.output,
        errorCode: toolCall.errorCode,
      })),
    };
  }

  private skipped(
    toolCall: AiWaiterProviderToolCall,
    reason: string,
    output: Record<string, unknown> = {},
  ): AiWaiterProviderToolCall {
    return {
      ...toolCall,
      status: AiWaiterToolCallStatus.skipped,
      output: {
        reason,
        ...output,
      },
    };
  }

  private failed(
    toolCall: AiWaiterProviderToolCall,
    error: unknown,
  ): AiWaiterProviderToolCall {
    return {
      ...toolCall,
      status: AiWaiterToolCallStatus.failed,
      errorCode: "ai_tool_execution_failed",
      errorMessage: this.errorMessage(error),
    };
  }

  private logToolError(toolName: AiWaiterToolName, error: unknown) {
    this.logger.warn({
      toolName,
      error: this.errorMessage(error),
    });
  }

  private record(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private stringValue(value: unknown, fallback = "") {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : fallback;
  }

  private truncate(value: string, maxLength: number) {
    const trimmed = value.trim();

    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return "AI tool execution failed";
  }
}
