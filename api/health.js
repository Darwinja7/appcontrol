export default async function handler(req, res) {
  res.json({
    status: "ok",
    app: "AppControl-web",
    mailConfigurado: Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM)
  });
}
