export const balkonaDemoQrToken = "balcona-main-t01";

export const balkonaDemoStaff = {
  email: "manager@balcona.local",
  password: "change-me-local-123"
} as const;

export const balkonaDemoRoutes = [
  {
    key: "customerQrDemo",
    href: `/guest/table/${balkonaDemoQrToken}`,
  },
  {
    key: "customerEntry",
    href: "/guest",
  },
  {
    key: "staffLogin",
    href: "/staff/login",
  },
  {
    key: "cashier",
    href: "/service/cashier",
  },
  {
    key: "menuAdmin",
    href: "/office/catalog",
  },
  {
    key: "branchTables",
    href: "/office/locations",
  },
  {
    key: "kitchenBarista",
    href: "/kitchen",
  },
  {
    key: "waiterFloor",
    href: "/service/waiter",
  },
  {
    key: "ownerManager",
    href: "/office",
  }
] as const;

export const balkonaReviewerJourney = [
  {
    key: "openTable",
    number: "01",
    role: ["Guest", "الضيف"],
    title: ["Open the demo table", "افتح ترابيزة العرض"],
    description: [
      "Start or resume the seeded T01 session from the same QR route a guest would scan.",
      "ابدأ أو استكمل جلسة T01 التجريبية من نفس رابط الـQR الذي يفتحه الضيف."
    ],
    outcome: ["Live table session", "جلسة ترابيزة حقيقية"],
    href: `/guest/table/${balkonaDemoQrToken}`
  },
  {
    key: "placeOrder",
    number: "02",
    role: ["Guest", "الضيف"],
    title: ["Build and submit an order", "كوّن الطلب وأرسله"],
    description: [
      "Browse the seeded menu photography, choose modifiers and submit the cart to operations.",
      "تصفح صور المنيو التجريبية، واختر الإضافات، ثم أرسل السلة إلى التشغيل."
    ],
    outcome: ["Order enters Service", "الطلب يصل إلى Service"],
    href: `/guest/table/${balkonaDemoQrToken}`
  },
  {
    key: "acceptOrder",
    number: "03",
    role: ["Cashier", "الكاشير"],
    title: ["Review and accept it", "راجع الطلب واقبله"],
    description: [
      "Open the live order intake, confirm the same table and accept the submitted order.",
      "افتح استقبال الطلبات المباشر، وتأكد من نفس الترابيزة، ثم اقبل الطلب."
    ],
    outcome: ["Production work created", "إنشاء مهام التحضير"],
    href: "/service/cashier?mode=cashier#orders"
  },
  {
    key: "prepareOrder",
    number: "04",
    role: ["Kitchen", "المطبخ"],
    title: ["Prepare and mark ready", "حضّر وحدد الطلب كجاهز"],
    description: [
      "The accepted items become station tasks. Start the ticket, then mark the work ready.",
      "الأصناف المقبولة تتحول إلى مهام محطات. ابدأ التذكرة ثم حددها كجاهزة."
    ],
    outcome: ["Ready handoff", "تسليم جاهز للخدمة"],
    href: "/kitchen"
  },
  {
    key: "serveOrder",
    number: "05",
    role: ["Waiter", "الخدمة"],
    title: ["Serve the ready order", "قدّم الطلب الجاهز"],
    description: [
      "Use the floor view to follow the ready handoff and close the service step.",
      "استخدم واجهة الصالة لمتابعة الطلب الجاهز وإغلاق خطوة التقديم."
    ],
    outcome: ["Table is served", "تم تقديم الطلب"],
    href: "/service/waiter?mode=waiter#floor"
  },
  {
    key: "requestBill",
    number: "06",
    role: ["Guest", "الضيف"],
    title: ["Request the bill", "اطلب الحساب"],
    description: [
      "Return to the same guest session, open Service or Bill and request the account.",
      "ارجع إلى نفس جلسة الضيف، وافتح Service أو Bill، ثم اطلب الحساب."
    ],
    outcome: ["Bill request reaches Service", "طلب الحساب يصل إلى Service"],
    href: `/guest/table/${balkonaDemoQrToken}`
  },
  {
    key: "presentBill",
    number: "07",
    role: ["Cashier", "الكاشير"],
    title: ["Present the bill", "قدّم الفاتورة"],
    description: [
      "Open Bills in Service and present the request for the same table session.",
      "افتح Bills في Service وقدّم فاتورة طلب نفس جلسة الترابيزة."
    ],
    outcome: ["Payment becomes available", "الدفع يصبح متاحًا"],
    href: "/service/cashier?mode=cashier#bills"
  },
  {
    key: "payBill",
    number: "08",
    role: ["Guest", "الضيف"],
    title: ["Complete the test payment", "أكمل الدفع التجريبي"],
    description: [
      "Use the provider shown by the staged checkout. The environment never processes real money.",
      "استخدم مزود الدفع الظاهر في صفحة الاختبار. البيئة لا تخصم أموالًا حقيقية."
    ],
    outcome: ["Receipt and paid state", "إيصال وحالة مدفوعة"],
    href: `/guest/table/${balkonaDemoQrToken}`
  },
  {
    key: "reviewOffice",
    number: "09",
    role: ["Office", "الإدارة"],
    title: ["See the operating result", "شاهد نتيجة التشغيل"],
    description: [
      "Finish in Office to see the shared order, service and money state reflected in management.",
      "اختم داخل Office لترى انعكاس الطلب والخدمة والحالة المالية على الإدارة."
    ],
    outcome: ["One connected operating truth", "حقيقة تشغيل واحدة مترابطة"],
    href: "/office"
  }
] as const;

export const balkonaDemoChecklist = [
  "openCustomerQr",
  "addItems",
  "useAiWaiter",
  "submitOrder",
  "loginStaff",
  "reviewMenuAdmin",
  "reviewBranchTables",
  "acceptOrder",
  "prepareTask",
  "resolveWaiter",
  "reviewOwner"
] as const;

export const balkonaDemoProofPoints = [
  "tableQrSession",
  "menuOrderFlow",
  "aiProposalFlow",
  "staffSession",
  "menuAdminReadiness",
  "branchQrReadiness",
  "cashierAcceptance",
  "preparationTasks",
  "waiterAttention",
  "ownerPulse",
  "realtimeRefresh"
] as const;

export const balkonaDemoCommands = [
  "docker compose up -d",
  "pnpm --filter @balcona-bar/api start:dev",
  '$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api/v1"',
  "pnpm web:dev"
] as const;
