import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";
import { DEFAULT_LOCALE, type Locale } from "./config";

export type Messages = typeof enMessages;
interface MessageNode {
  [key: string]: string | MessageNode;
}

type MessageValue = string | MessageNode;

const messagesByLocale: Record<Locale, Messages> = {
  en: enMessages,
  ar: arMessages
};

export function getMessages(locale: Locale): Messages {
  return messagesByLocale[locale] ?? messagesByLocale[DEFAULT_LOCALE];
}

export function getMessageValue(
  messages: Messages,
  key: string
): string | undefined {
  const value = key.split(".").reduce<MessageValue | undefined>(
    (current, segment) =>
      current && typeof current === "object"
        ? (current as Record<string, MessageValue>)[segment]
        : undefined,
    messages
  );

  return typeof value === "string" ? value : undefined;
}

export function formatMessage(
  template: string,
  values?: Record<string, string | number>
) {
  if (!values) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : match
  );
}

export function translate(
  locale: Locale,
  key: string,
  values?: Record<string, string | number>
) {
  const primary = getMessageValue(getMessages(locale), key);
  const fallback = getMessageValue(getMessages(DEFAULT_LOCALE), key);

  return formatMessage(primary ?? fallback ?? key, values);
}
