export const onRequest: PagesFunction = () => {
  return Response.json({ status: "ok", service: "streamkit" });
};
