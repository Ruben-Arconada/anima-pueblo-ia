# Modelos 3D de Ánima

## El personaje del jugador
Deja aquí el modelo con este nombre exacto:

```
app/models/jugador.glb
```

En cuanto esté, el juego lo carga solo (sustituye la cápsula azul). Si no está,
sigue la cápsula. Cargador en `village.js → _cargarModeloJugador()`.

### Formato y specs
- **`.glb`** (glTF 2.0 binario): malla + materiales + texturas + esqueleto + animaciones en un fichero.
- **Rig humanoide** (compatible Mixamo). Si tienes el T-pose, súbelo a Mixamo → auto-rig + animaciones → exporta `.glb`.
- **Animaciones:** al menos **idle** y **walk** (el cargador las busca por nombre: `idle`/`stand` y `walk`/`camin`/`run`; si no, usa la 1ª y la 2ª).
- **Polígonos:** 8k–15k triángulos. **Texturas:** 1024² (máx 2048), un material PBR.
- **Escala/orientación:** se auto-escala a ~1,8 m y se apoyan los pies en y=0. Mira hacia **+Z**.
- **Peso:** `.glb` < 3-5 MB.

> Cuando lo dejes, dímelo: afino orientación, escala y el mapeo de animaciones con TU modelo
> real (los nombres de los clips varían). El pre-cableado hace que aparezca; el pulido fino lo hago al verlo.
