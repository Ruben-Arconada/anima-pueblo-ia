# Audio de Ánima

El sistema de sonido ya está montado (`village.js` → `iniciarAudio()`). Solo hay que
dejar aquí **dos ficheros** y funcionarán solos (si no están, hay silencio sin errores):

## `grillos.mp3` — ambiente de noche
- Grillos suaves de campo. **Agradable, no pesado.** Sube de volumen solo al anochecer
  (lo controla el ciclo día/noche) y se apaga de día.
- Loop **sin costura** (que empalme limpio). Duración ~20-40 s.
- Mono o estéreo. **mp3** ~128 kbps. Peso objetivo < 1 MB.

## `cantina.mp3` — melodía de la taberna de Bruno
- Melodía de taberna **bajita y posicional**: solo se aprecia al **acercarse** a la
  cantina (audio 3D, se atenúa con la distancia). Anclada en la puerta de Bruno.
- Loop sin costura. Duración ~30-90 s. **Mono** (mejor para audio posicional).
- **mp3** ~128 kbps. Peso objetivo < 1,5 MB.

## Notas
- Formatos: **.mp3** (máxima compatibilidad) u **.ogg**. Si usas otro nombre/extensión,
  dímelo y ajusto la ruta en `iniciarAudio()`.
- El audio arranca con el botón **“Entrar al pueblo”** (política de autoplay del navegador).
- Botón **🔊** arriba para silenciar/activar.
- Para uso comercial, que sean pistas **con licencia tuya o CC0** (ver doc de riesgos/licencias).
