// FALLBACK con personalidad (sin IA). Se usa si el navegador no tiene WebGPU/memoria.
// Mantiene el pueblo jugable y con carácter; comparte el MISMO lore cruzado que la IA
// (carta Bruno↔Marta, valeriana de Elena, bollos de Tomás) para no contradecirla.

const BANCO = {
  bruno: {
    hola: ["Hmpf. Hola. ¿Vas a pedir algo o solo a calentar el taburete?"],
    keys: [
      [/cerveza|beber|trago|guiso/i, "Una jarra entonces. Y no me cuentes tus penas, que ya tengo las mías."],
      [/marta|alcaldesa/i, "¿Marta? Bah. Esa y yo... agua pasada. Cosas de cuando éramos jóvenes."],
      [/elena|valeriana|hierba|infusi/i, "Elena y sus hierbas. La valeriana esa... no me hace nada. Nada, ¿eh?"],
      [/tom[aá]s|niñ|bollo/i, "Ese crío me roba la merienda. Luego le guardo otra, pero ni se te ocurra decírselo."],
      [/feria|fiesta/i, "¿Feria? Hace años que no abro para una. La última... mejor no hablar de fuego."],
      [/carta|secreto|barra/i, "¿Qué carta? No hay ninguna carta bajo la barra. Cambia de tema."],
      [/fuego|incendio|taberna|ard/i, "Mi otra taberna ardió una noche de feria. Por eso vigilo el fuego. Ya está, no preguntes más."],
      [/adios|chao|hasta/i, "Sí, sí. Cierra la puerta al salir."],
    ],
    base: ["¿Y qué quieres que te diga? El pueblo es el pueblo.", "Habla claro, que tengo jarras que fregar.", "Bah. He oído cosas peores en esta barra."],
  },
  elena: {
    hola: ["¡Hola! Cuidado, no pises la lavanda. ¿Buscas algún remedio?"],
    keys: [
      [/planta|hierba|remedio|cura|flor/i, "Tengo tomillo para el ánimo y, en lo hondo del bosque, una flor azul que dicen que cura penas."],
      [/bruno|tabern|cantina/i, "Pobre Bruno, tan solo. Le llevo valeriana para que duerma, aunque finja que no le ayuda."],
      [/marta|bosque|talar/i, "Con Marta choco: quiere talar el bosque para casas. Pero el bosque a mí me curó, ¿sabes?"],
      [/tom[aá]s|niñ/i, "¡Tomás es mi pequeño ayudante! Lo trato como a un mayor, por eso me adora."],
      [/forastera|fuera|ciudad/i, "Llegué hace tres años huyendo de una ciudad que me apagaba. Aún me siento un poco de fuera."],
      [/adios|chao|hasta/i, "¡Vuelve cuando quieras! El jardín siempre te espera."],
    ],
    base: ["¿Sabías que cada planta de aquí tiene su historia? Igual que cada vecino.", "El bosque habla, solo hay que escucharlo. ¿Tú qué me cuentas?", "Qué curioso lo que dices. Me recuerda a una raíz que encontré ayer."],
  },
  tomas: {
    hola: ["¡Eh, tú! ¿Sabes guardar un secreto? Yo no mucho, jeje."],
    keys: [
      [/secreto|carta|barra/i, "¡Vi a Bruno esconder una carta bajo la barra! No sé qué dice... ¿la leemos? jeje."],
      [/bruno|bollo/i, "A Bruno le robo bollos. No se lo digas... le tengo respeto, pero ni de coña lo admito."],
      [/elena/i, "¡Elena es la mejor! Me deja ayudarla con las plantas, como si fuera mayor."],
      [/marta|alcaldesa/i, "Uy, Marta me da un poco de miedo. Siempre me pilla en las travesuras, jeje."],
      [/padre|papa|papá/i, "Mi padre se fue y... bah, ¡da igual! ¿Jugamos a otra cosa?"],
      [/jugar|juego/i, "¡Pillas tú! No, espera, pillas tú. ¡Corre!"],
      [/adios|chao|hasta/i, "¡Adióóós! Si ves a Bruno, dile que no fui yo."],
    ],
    base: ["¿A que no me pillas? ...vale, vale, ahora hablamos.", "Mi madre dice que pregunto mucho. ¿Tú preguntas mucho?", "¡Jo, qué aburrido es el pueblo hoy! Cuéntame algo guay."],
  },
  marta: {
    hola: ["Bienvenido. Soy Marta, la alcaldesa. ¿En qué puedo ayudarte?"],
    keys: [
      [/bruno|tabern|cantina/i, "Bruno y yo... hay un nudo viejo sin desatar. Finjo frialdad, pero ahí sigue."],
      [/elena|bosque|talar/i, "Discuto con Elena por el bosque, sí. La respeto, pero el pueblo necesita casas nuevas."],
      [/tom[aá]s|niñ/i, "Tomás me saca de quicio. Y aun así, veo en él el futuro que quiero salvar."],
      [/feria|fiesta/i, "Quiero sacar la feria adelante. Pero sin Bruno y su cantina, no hay fiesta de verdad."],
      [/carta|secreto/i, "¿Una carta? ...De jóvenes, la cabeza pudo más que el corazón. No diré más."],
      [/pueblo|ayuda|problema/i, "Cargo con Ánima desde que murió mi marido. Mi miedo es que se vacíe."],
      [/adios|chao|hasta/i, "Que tengas un buen día. Las puertas del ayuntamiento están abiertas."],
    ],
    base: ["Lo tendré en cuenta. Un pueblo se construye escuchando.", "Interesante. Ánima necesita gente que se moje como tú.", "Te entiendo. Daré una vuelta a ese asunto."],
  },
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class ScriptedBrain {
  kind = "scripted";
  label = "Modo sin IA (tu navegador no soporta WebGPU)";

  async init() {}

  async generate(npc, history, userText, opts = {}) {
    const { onToken, deseo } = opts;
    const b = BANCO[npc.id] || BANCO.bruno;
    let text;
    const hit = b.keys.find(([re]) => re.test(userText));
    if (history.length === 0 && /^\s*(hola|buenas|hey|hi|qué tal|que tal)\b/i.test(userText)) {
      text = pick(b.hola);
    } else if (hit) {
      text = hit[1];
    } else if (deseo && npc.deseoHint && Math.random() < 0.5) {
      text = npc.deseoHint; // en modo sin IA también asoma su quest
    } else {
      text = pick(b.base);
    }

    const t0 = performance.now();
    for (const ch of text) {
      onToken && onToken(ch);
      await new Promise((r) => setTimeout(r, 12));
    }
    const total = performance.now() - t0;
    return { text, metrics: { ttft: 60, total, tokens: text.split(/\s+/).length, tps: null } };
  }
}
