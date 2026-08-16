export function jsonResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function okResponse<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function errResponse(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}
