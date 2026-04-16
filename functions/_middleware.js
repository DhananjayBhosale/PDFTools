export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === "pdftools.dhananjaytech.app") {
    url.hostname = "pdfchef.dhananjaytech.app";
    return Response.redirect(url.toString(), 308);
  }

  return context.next();
}
