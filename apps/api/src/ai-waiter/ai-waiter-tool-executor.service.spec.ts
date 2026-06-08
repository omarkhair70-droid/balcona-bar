import {
  AiWaiterMessageKind,
  AiWaiterToolCallStatus,
  AiWaiterToolName,
  WaiterCallType,
} from "@prisma/client";
import { BillRequestsService } from "../bill-requests/bill-requests.service";
import { WaiterCallsService } from "../waiter-calls/waiter-calls.service";
import { AiWaiterToolExecutorService } from "./ai-waiter-tool-executor.service";
import { AiWaiterContext, AiWaiterProviderResult } from "./ai-waiter.types";

const context: AiWaiterContext = {
  tableSession: {
    id: "table-session-1",
    companyId: "company-1",
    branchId: "branch-1",
    tableId: "table-1",
    status: "active",
  },
  branch: {
    id: "branch-1",
    companyId: "company-1",
    name: "Balcona Main",
    slug: "main",
  },
  effectiveExperience: {},
  cartSummary: {},
  recentMessages: [],
  menuItems: [],
  operationalContext: {
    generatedAt: "2026-01-01T00:00:00.000Z",
    orders: {
      activeCount: 1,
      latest: {
        id: "order-1",
        orderNumber: "A001",
        status: "preparing",
        customerStatus: "preparing",
        submittedAt: "2026-01-01T00:00:00.000Z",
        itemCount: 2,
        preparationSummary: {
          pending: 1,
          preparing: 1,
          ready: 0,
          cancelled: 0,
          stations: ["barista"],
        },
      },
      recent: [],
    },
    bill: {
      activeBillRequestId: null,
      activeBillRequestStatus: null,
      hasBillableOrders: true,
      billStatus: null,
      paymentStatus: null,
      receiptAvailable: false,
    },
    waiterCalls: {
      activeCount: 0,
    },
    branchOps: {
      aiWaiterEnabled: true,
      waiterCallsEnabled: true,
      billFlowEnabled: true,
      tableAttentionEnabled: true,
    },
  },
};

function result(
  overrides: Partial<AiWaiterProviderResult> = {},
): AiWaiterProviderResult {
  return {
    content: "حاضر",
    kind: AiWaiterMessageKind.action_result,
    suggestedActions: [],
    toolCalls: [],
    metadata: {},
    ...overrides,
  };
}

function createService(input: {
  bill?: Partial<BillRequestsService>;
  waiter?: Partial<WaiterCallsService>;
} = {}) {
  const billRequestsService = {
    requestBill: jest.fn().mockResolvedValue({
      billRequest: { id: "bill-request-1", status: "open" },
    }),
    ...input.bill,
  } as unknown as BillRequestsService;
  const waiterCallsService = {
    createForTableSession: jest.fn().mockResolvedValue({
      waiterCall: { id: "waiter-call-1", status: "open" },
    }),
    ...input.waiter,
  } as unknown as WaiterCallsService;

  return {
    service: new AiWaiterToolExecutorService(
      billRequestsService,
      waiterCallsService,
    ),
    billRequestsService,
    waiterCallsService,
  };
}

describe("AiWaiterToolExecutorService", () => {
  it("requests a bill through the existing service only when the table is billable", async () => {
    const { service, billRequestsService } = createService();

    const executed = await service.execute({
      context,
      customerMessage: "ممكن الحساب؟",
      providerResult: result({
        metadata: { intent: "request_bill" },
        toolCalls: [
          {
            toolName: AiWaiterToolName.request_bill,
            status: AiWaiterToolCallStatus.skipped,
          },
        ],
      }),
    });

    expect(billRequestsService.requestBill).toHaveBeenCalledWith(
      "table-session-1",
      { note: "ممكن الحساب؟" },
    );
    expect(executed.toolCalls[0]).toMatchObject({
      toolName: AiWaiterToolName.request_bill,
      status: AiWaiterToolCallStatus.succeeded,
      output: { billRequestId: "bill-request-1", status: "open" },
    });
    expect(executed.metadata?.toolExecution).toMatchObject({
      refreshCustomerState: true,
    });
  });

  it("skips duplicate bill requests from active bill context", async () => {
    const { service, billRequestsService } = createService();

    const executed = await service.execute({
      context: {
        ...context,
        operationalContext: {
          ...context.operationalContext!,
          bill: {
            activeBillRequestId: "bill-request-active",
            activeBillRequestStatus: "open",
            hasBillableOrders: true,
          },
        },
      },
      customerMessage: "bill please",
      providerResult: result({
        metadata: { intent: "request_bill" },
      }),
    });

    expect(billRequestsService.requestBill).not.toHaveBeenCalled();
    expect(executed.toolCalls[0]).toMatchObject({
      toolName: AiWaiterToolName.request_bill,
      status: AiWaiterToolCallStatus.skipped,
      output: {
        reason: "active_bill_request_exists",
        activeBillRequestId: "bill-request-active",
      },
    });
  });

  it("creates a priority service-problem waiter call when explicitly requested", async () => {
    const { service, waiterCallsService } = createService();

    const executed = await service.execute({
      context,
      customerMessage: "المشروب بارد وغلط، ناديلي ويتر",
      providerResult: result({
        metadata: { intent: "service_problem" },
      }),
    });

    expect(waiterCallsService.createForTableSession).toHaveBeenCalledWith(
      "table-session-1",
      {
        type: WaiterCallType.order_problem,
        priority: 2,
        message: "المشروب بارد وغلط، ناديلي ويتر",
      },
    );
    expect(executed.toolCalls[0]).toMatchObject({
      toolName: AiWaiterToolName.call_waiter,
      status: AiWaiterToolCallStatus.succeeded,
      output: { waiterCallId: "waiter-call-1", priority: 2 },
    });
  });

  it("skips waiter calls when an active call already exists", async () => {
    const { service, waiterCallsService } = createService();

    const executed = await service.execute({
      context: {
        ...context,
        operationalContext: {
          ...context.operationalContext!,
          waiterCalls: {
            activeCount: 1,
            latest: {
              id: "waiter-call-active",
              type: "call_waiter",
              status: "open",
              priority: 1,
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          },
        },
      },
      customerMessage: "call a waiter",
      providerResult: result({
        metadata: { intent: "call_waiter" },
      }),
    });

    expect(waiterCallsService.createForTableSession).not.toHaveBeenCalled();
    expect(executed.toolCalls[0]).toMatchObject({
      toolName: AiWaiterToolName.call_waiter,
      status: AiWaiterToolCallStatus.skipped,
      output: {
        reason: "active_waiter_call_exists",
        activeWaiterCallId: "waiter-call-active",
      },
    });
  });

  it("reads order status from context without mutating services", async () => {
    const { service, billRequestsService, waiterCallsService } = createService();

    const executed = await service.execute({
      context,
      customerMessage: "فين طلبي؟",
      providerResult: result({
        metadata: { intent: "order_status" },
      }),
    });

    expect(billRequestsService.requestBill).not.toHaveBeenCalled();
    expect(waiterCallsService.createForTableSession).not.toHaveBeenCalled();
    expect(executed.toolCalls[0]).toMatchObject({
      toolName: AiWaiterToolName.read_order_status,
      status: AiWaiterToolCallStatus.succeeded,
      output: {
        latestOrder: {
          id: "order-1",
          customerStatus: "preparing",
        },
      },
    });
  });

  it("records tool failures without throwing to the customer flow", async () => {
    const { service } = createService({
      bill: {
        requestBill: jest.fn().mockRejectedValue(new Error("service down")),
      },
    });

    const executed = await service.execute({
      context,
      customerMessage: "bill please",
      providerResult: result({
        metadata: { intent: "request_bill" },
      }),
    });

    expect(executed.toolCalls[0]).toMatchObject({
      toolName: AiWaiterToolName.request_bill,
      status: AiWaiterToolCallStatus.failed,
      errorCode: "ai_tool_execution_failed",
      errorMessage: "service down",
    });
  });
});
