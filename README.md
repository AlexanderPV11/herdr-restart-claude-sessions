# herdr-restart-claude-sessions

Mod de [Herdr](https://herdr.dev) que **restaura tus conversaciones de Claude Code después de reiniciar o apagar la compu**. Cada agente que tenías abierto vuelve a su terminal y retoma su conversación con `claude --resume`.

## El problema

Los procesos no sobreviven a un reinicio. Herdr conserva spaces, tabs, splits y las direcciones de las terminales (`t17`, ...), y cada terminal perdida vuelve como una shell vacía en su última carpeta, pero **el comando original no se vuelve a ejecutar**. Los agentes quedan apagados y hay que retomarlos a mano, uno por uno.

## Cómo funciona

1. **Hook de Claude Code** (`scripts/herdr-session-hook.js`). En `SessionStart` guarda el id de la sesión y su carpeta en `~/.config/herdr-app/data/claude-sessions/<terminal>.json`. La terminal se identifica con `HC_TERMINAL_ID`, variable que herdr-core define dentro de cada terminal, así que dos agentes en la misma carpeta no se confunden. Se actualiza solo en `/clear` o `/resume`, porque cambia el id de sesión.
2. **Salida deliberada.** En `SessionEnd`, si el motivo es `prompt_input_exit` (`/exit`, Ctrl+C) o `logout`, borra el registro: esa terminal no se restaura. Con otros motivos (proceso muerto, apagado) lo conserva.
3. **Mod** (`mods/claude-session-restore`). Durante los 2 primeros minutos tras arrancar herdr, busca terminales locales vivas **sin agente** que tengan registro y les envía `claude --resume <id>` con `hc send`. Si la carpeta de la shell no coincide con la guardada, antes hace `cd`. Muestra una barra fina abajo y una notificación al restaurar.

## Requisitos

- Herdr app y herdr-core (`hc`), y Node.js (para el hook).
- Claude Code con hooks (`SessionStart` / `SessionEnd`).
- Probado en Windows con herdr-core 0.1.21.

## Instalación

**1. El mod**

```sh
cp -R mods/claude-session-restore ~/.config/herdr-app/mods/
```

Como su `mod.json` tiene `"place": "bottom"`, herdr lo acopla solo en tu layout actual como una barra de 22 px.

**2. El hook**

```sh
cp scripts/herdr-session-hook.js ~/.claude/herdr-session-hook.js
```

**3. Claude Code: agrega los hooks a `~/.claude/settings.json`** con la ruta absoluta de tu máquina (usa `/` también en Windows):

```json
"hooks": {
  "SessionStart": [
    { "hooks": [ { "type": "command", "command": "node \"C:/Users/<tu-usuario>/.claude/herdr-session-hook.js\"" } ] }
  ],
  "SessionEnd": [
    { "hooks": [ { "type": "command", "command": "node \"C:/Users/<tu-usuario>/.claude/herdr-session-hook.js\"" } ] }
  ]
}
```

Si ya tienes una clave `hooks`, agrega estas entradas a las listas existentes.

**4. Comprueba:** `herdr-app check ~/.config/herdr-app/mods/claude-session-restore`.

**5. Registra tus agentes actuales.** Los hooks se cargan al iniciar Claude, así que los agentes que ya estaban abiertos no quedan registrados. Reinícialos con `claude --resume` o `claude --continue`.

## Qué pasa si borro algo

- **Cierro un panel, tab o space:** la terminal deja de existir y no se restaura. La conversación sigue en `~/.claude/projects/` y puedes retomarla con `claude --resume`.
- **Salgo del agente (`/exit`) sin cerrar la terminal:** el registro se borra y queda una shell normal.

## Qué modificar para que funcione en tu setup

1. **Ventana de restauración.** `WINDOW_MS` en `main.js` (120 s) y `MAX_AGE` (14 días, registros más viejos se ignoran).
2. **El comando.** Se arma en `scan()`: `claude --resume <id>`. Añade ahí flags si los usas (por ejemplo `--model`).
3. **Barra.** Altura en `mod.json` (`size`). Para no mostrarla, cambia `place` a `none` y pon el bloque en tu layout con el tamaño que quieras.
4. **Herdr en otra carpeta.** El hook escribe en `~/.config/herdr-app/data/claude-sessions/` (constante `DIR`) y el mod lee `appHome()/data/claude-sessions/`. Si usas `HERDR_APP_HOME`, cambia `DIR`.
5. **Shell.** El `cd` previo usa `cd "ruta"; comando` con `/`, válido en PowerShell y en bash.

## Limitaciones

- Se recupera la **conversación**, no el trabajo en curso: si el agente estaba a mitad de una tarea, vuelve con su historial y hay que decirle que continúe.
- Solo terminales locales; las de otras máquinas (`machine/tN`) se ignoran.
- Solo se restauran los agentes registrados por el hook (los abiertos después de instalarlo).
- Si cierras un panel con la X, Claude muere sin salida limpia y su archivo `<terminal>.json` queda huérfano. Es inofensivo mientras esa dirección no se reutilice; si herdr la reutilizara para una terminal nueva, el mod le escribiría un `claude --resume` dentro de la ventana de arranque. No se ha verificado si herdr reutiliza direcciones.
- Un corte de luz restaura el último estado guardado.
- No se probó aún el ciclo completo de reinicio de la compu.

## Licencia

MIT, ver `LICENSE`.
