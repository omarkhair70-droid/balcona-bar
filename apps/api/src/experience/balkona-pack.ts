import {
  ContentBlockPlacement,
  NotificationChannel,
  NotificationKind,
  VenueZoneType,
} from '@prisma/client';

export const BALKONA_PACK_KEY = 'balkona-warm-dark';
export const BALKONA_PACK_LANGUAGE = 'ar-EG';

export const balkonaTheme = {
  name: 'warm-dark-premium-cafe',
  mood: ['warm', 'calm', 'premium', 'arabic-first'],
  heroStyle: 'immersive dark cafe warmth',
};

export const balkonaDesignTokens = {
  colors: {
    background: '#120D0A',
    surface: '#1D1510',
    primary: '#C68A4A',
    accent: '#7A2E2E',
    text: '#FFF7EA',
    mutedText: '#B7A99A',
  },
  radius: {
    card: 24,
    button: 999,
  },
  typography: {
    heading: 'serif-premium',
    body: 'sans-clean',
  },
};

export const balkonaMotionTokens = {
  pace: 'calm',
  transitions: {
    screen: 'soft-fade',
    card: 'gentle-rise',
  },
};

export const balkonaLayoutConfig = {
  customerHome: {
    emphasis: 'welcome-first',
    menuDensity: 'comfortable',
  },
};

export const balkonaBrandVoice = {
  languagePreference: 'Arabic-first',
  traits: ['warm', 'calm', 'premium', 'not robotic'],
  tagline: 'فوق الدوشة',
};

export const balkonaAiWaiterTone = {
  dialect: 'friendly Egyptian Arabic',
  suggestions: 'short helpful suggestions',
  pricePolicy: 'never changes prices',
  confirmationPolicy: 'always confirms via cart',
};

export const balkonaContentBlocks = [
  {
    placement: ContentBlockPlacement.customer_welcome,
    key: 'balkona-customer-welcome',
    title: 'أهلاً بيك في بلكونة',
    body: 'اطلع من دوشة اليوم وخد نفس فوق.',
    sortOrder: 10,
  },
  {
    placement: ContentBlockPlacement.customer_home,
    key: 'balkona-customer-home',
    title: 'فوق الدوشة',
    body: 'هنا القعدة بتاخد نفس.',
    sortOrder: 20,
  },
  {
    placement: ContentBlockPlacement.ai_waiter_intro,
    key: 'balkona-ai-waiter-intro',
    title: 'الويتر الذكي معاك',
    body: 'قولّي نفسك في إيه وأنا أرشحلك من المنيو.',
    sortOrder: 30,
  },
  {
    placement: ContentBlockPlacement.waiter_call,
    key: 'balkona-waiter-call',
    title: 'الويتر في الطريق',
    body: 'طلبك وصل للستاف.',
    sortOrder: 40,
  },
  {
    placement: ContentBlockPlacement.bill_flow,
    key: 'balkona-bill-flow',
    title: 'الحساب اتسجل',
    body: 'هنجهزهولك حالًا.',
    sortOrder: 50,
  },
] as const;

export const balkonaNotificationTemplates = [
  {
    key: 'balkona-welcome',
    kind: NotificationKind.welcome,
    channel: NotificationChannel.in_app,
    title: 'أهلاً بيك في بلكونة',
    body: 'اطلع من دوشة اليوم وخد نفس فوق.',
  },
  {
    key: 'balkona-order-accepted',
    kind: NotificationKind.order_accepted,
    channel: NotificationChannel.in_app,
    title: 'طلبك اتقبل',
    body: 'الفريق بدأ يجهز طلبك.',
  },
  {
    key: 'balkona-preparation-started',
    kind: NotificationKind.preparation_started,
    channel: NotificationChannel.in_app,
    title: 'بدأنا التجهيز',
    body: 'طلبك دخل مرحلة التحضير.',
  },
  {
    key: 'balkona-preparation-ready',
    kind: NotificationKind.preparation_ready,
    channel: NotificationChannel.in_app,
    title: 'جزء من طلبك جاهز',
    body: 'الفريق جهز جزء من الطلب.',
  },
  {
    key: 'balkona-order-served',
    kind: NotificationKind.order_served,
    channel: NotificationChannel.in_app,
    title: 'طلبك وصل',
    body: 'استمتع بالقعدة فوق الدوشة.',
  },
  {
    key: 'balkona-bill-requested',
    kind: NotificationKind.bill_requested,
    channel: NotificationChannel.in_app,
    title: 'الحساب اتسجل',
    body: 'هنجهزهولك حالًا.',
  },
  {
    key: 'balkona-bill-presented',
    kind: NotificationKind.bill_presented,
    channel: NotificationChannel.in_app,
    title: 'الحساب في الطريق',
    body: 'الفريق بيجهز الحساب.',
  },
  {
    key: 'balkona-bill-closed',
    kind: NotificationKind.bill_closed,
    channel: NotificationChannel.in_app,
    title: 'الحساب اتقفل',
    body: 'نورت بلكونة.',
  },
  {
    key: 'balkona-waiter-call',
    kind: NotificationKind.waiter_call,
    channel: NotificationChannel.in_app,
    title: 'الويتر في الطريق',
    body: 'طلبك وصل للستاف.',
  },
] as const;

export const balkonaVenueZones = [
  {
    name: 'Entrance',
    slug: 'entrance',
    type: VenueZoneType.entrance,
    description: 'Guest arrival and first welcome moment.',
    metadata: { experienceRole: 'arrival' },
  },
  {
    name: 'Calm Zone',
    slug: 'calm-zone',
    type: VenueZoneType.seating_area,
    description: 'Quiet seating for slow coffee and focused conversation.',
    metadata: { mood: 'calm', experienceRole: 'slow_seating' },
  },
  {
    name: 'Quick Zone',
    slug: 'quick-zone',
    type: VenueZoneType.seating_area,
    description: 'Fast seating for quick orders and short stays.',
    metadata: { mood: 'quick', experienceRole: 'quick_turnover' },
  },
  {
    name: 'Fusion Photo Zone',
    slug: 'fusion-photo-zone',
    type: VenueZoneType.custom,
    description: 'Central visual transition area.',
    metadata: { mood: 'photo', experienceRole: 'hero_zone' },
  },
  {
    name: 'Cashier Zone',
    slug: 'cashier-zone',
    type: VenueZoneType.cashier,
    description: 'Operational cashier and bill handoff area.',
    metadata: { experienceRole: 'cashier_handoff' },
  },
] as const;
