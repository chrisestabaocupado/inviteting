export function jsonResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function okResponse<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function errResponse(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

export function getEventoId(request: Request) {
  const value =
    request.headers.get("x-evento-id") ??
    new URL(request.url).searchParams.get("evento");
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
