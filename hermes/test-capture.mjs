import { enviarCaptura } from "./appcontrol-client.mjs";

const resultado = await enviarCaptura(
  {
    sender: process.env.TEST_SENDER || "999000111",
    payload: {
      proyecto: "P001",
      torre: "T2",
      nivel: "18",
      zona: "A1803",
      actividad: "A001",
      avance: 75,
      observacion: "prueba desde bridge Telegram",
    },
  },
  `tg:test:${Date.now()}`
);

console.log(JSON.stringify(resultado, null, 2));
