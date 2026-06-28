// FALLBACK con personalidad (sin IA). Se usa si el navegador no tiene WebGPU.
// No "improvisa" de verdad, pero mantiene el pueblo jugable y con carácter,
// para que la URL NUNCA aparezca rota. Va etiquetado claramente en la interfaz.

const BANCO = {
  bruno: {
    hola: ["Hmpf. Hola. ¿Vas a pedir algo o solo a calentar el taburete?"],
    keys: [
      [/cerveza|beber|trago/i, "Una jarra entonces. Y no me cuentes tus penas, que ya tengo las mías."],
      [/secreto|chisme/i, "Aquí los secretos se quedan en la barra. Como las manchas."],
      [/adios|chao|hasta/i, "Sí, sí. Cierra la puerta al salir."],
    ],
    base: [
      "¿Y qué quieres que te diga? El pueblo es el pueblo.",
      "Habla claro, que tengo jarras que fregar.",
      "Bah. He oído cosas peores en esta barra.",
    ],
  },
  elena: {
    hola: ["¡Hola! Cuidado, no pises la lavanda. ¿Buscas algún remedio?"],
    keys: [
      [/planta|hierba|remedio|cura/i, "Tengo justo lo que necesitas: tomillo para el ánimo y menta para la cabeza."],
      [/triste|mal|dolor/i, "Una infusión de manzanilla y aire fresco. Verás cómo mejora todo."],
      [/adios|chao|hasta/i, "¡Vuelve cuando quieras! El jardín siempre te espera."],
    ],
    base: [
      "¿Sabías que cada planta de aquí tiene su historia? Igual que cada vecino.",
      "El bosque habla, solo hay que escucharlo. ¿Tú qué me cuentas?",
      "Qué curioso lo que dices. Me recuerda a una raíz que encontré ayer.",
    ],
  },
  tomas: {
    hola: ["¡Eh, hola! ¿Jugamos a algo? ¿Sabes esconderte bien?"],
    keys: [
      [/secreto/i, "¡Te cuento uno! ...mejor no, que se me escapa siempre, jeje."],
      [/jugar|juego/i, "¡Pillas tú! No, espera, pillas tú. ¡Corre!"],
      [/adios|chao|hasta/i, "¡Adióóós! Si ves a Bruno, dile que no fui yo."],
    ],
    base: [
      "¿A que no me pillas? ...vale, vale, ahora hablamos.",
      "Mi madre dice que pregunto mucho. ¿Tú preguntas mucho?",
      "¡Jo, qué aburrido es el pueblo hoy! Cuéntame algo guay.",
    ],
  },
  marta: {
    hola: ["Bienvenido. Soy Marta, la alcaldesa. ¿Qué te trae por Ánima?"],
    keys: [
      [/pueblo|ayuda|problema/i, "Anoto tu preocupación. En Ánima nos ocupamos de la gente, no de los papeles."],
      [/fiesta|evento/i, "La feria es el mes que viene. Si quieres echar una mano, serás bienvenido."],
      [/adios|chao|hasta/i, "Que tengas un buen día. Las puertas del ayuntamiento están abiertas."],
    ],
    base: [
      "Lo tendré en cuenta. Un pueblo se construye escuchando.",
      "Interesante. Ánima necesita gente que se moje como tú.",
      "Te entiendo. Daré una vuelta a ese asunto.",
    ],
  },
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class ScriptedBrain {
  kind = "scripted";
  label = "Modo sin IA (tu navegador no soporta WebGPU)";

  async init() {}

  async generate(npc, history, userText, { onToken } = {}) {
    const b = BANCO[npc.id] || BANCO.bruno;
    let text;
    if (history.length === 0 && /^\s*(hola|buenas|hey|hi)\b/i.test(userText)) {
      text = pick(b.hola);
    } else {
      const hit = b.keys.find(([re]) => re.test(userText));
      text = hit ? hit[1] : pick(b.base);
    }

    const t0 = performance.now();
    // pequeño "escribiendo..." carácter a carácter para que se sienta vivo
    for (const ch of text) {
      onToken && onToken(ch);
      await new Promise((r) => setTimeout(r, 12));
    }
    const total = performance.now() - t0;
    return { text, metrics: { ttft: 60, total, tokens: text.split(/\s+/).length, tps: null } };
  }
}
