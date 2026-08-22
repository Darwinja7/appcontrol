export default async function handler(req, res) {
  res.setHeader("Set-Cookie", "appcontrol_session=; Path=/; HttpOnly; Max-Age=0");
  res.json({ success: true });
}
