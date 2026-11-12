const cookieName = "lang";

export function saveLanguageCookie(locale: string) {
  if (locale === "en" || locale === "ja") {
    document.cookie = `${cookieName}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
}

export function refreshLanguageCookie() {
  const prefix = `${cookieName}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (cookie) {
    saveLanguageCookie(cookie.slice(prefix.length));
  }
}
