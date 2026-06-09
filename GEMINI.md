# Guía de Desarrollo y Despliegue para Agentes Gemini

Este archivo documenta las reglas esenciales, comandos específicos del entorno y el flujo de trabajo para evitar errores en futuras sesiones de desarrollo.

## 💻 Entorno y Ejecución de Comandos
- **Sistema Operativo:** Windows.
- **Terminal:** PowerShell / CMD.
- **Regla Crítica:** Debido a restricciones de ejecución de scripts de PowerShell en este entorno, la ejecución directa de comandos como `npm` o `git` puede fallar si intentan llamar a scripts `.ps1`. 
- **Solución:** Ejecutar siempre los comandos a través de `cmd.exe /c` (por ejemplo, `cmd.exe /c "npm run build"` o `cmd.exe /c "git status"`).

## 🛠️ Flujo de Compilación y Verificación
Antes de confirmar cualquier cambio o realizar un despliegue, es obligatorio verificar que la aplicación compila sin errores:
```bash
cmd.exe /c "npm run build"
```
Esto ejecuta TypeScript (`tsc`) y construye el frontend en la carpeta `dist`. Asegúrate de que no haya errores de sintaxis o de tipado.

## 🚀 Despliegue en Vercel
Para publicar los cambios en producción en Vercel, utiliza la CLI de Vercel de forma no interactiva (ya que el proyecto está previamente vinculado y configurado):
```bash
cmd.exe /c "npx vercel --prod --yes"
```
*Nota: La configuración de rutas y el entrypoint de la API para las Serverless Functions de Vercel están definidos en [vercel.json](file:///c:/Users/patri/appPisos/vercel.json) y en el directorio [api/index.js](file:///c:/Users/patri/appPisos/api/index.js).*

## 🐙 Control de Versiones (Git)
Al confirmar cambios en el repositorio, sigue estas pautas:
1. **Compilar primero:** Asegúrate de compilar el proyecto (`npm run build`) de modo que los archivos optimizados bajo `dist/` se generen y se incluyan en el commit.
2. **Archivos a incluir:** 
   - Modificaciones de código fuente en `src/` (por ejemplo, `src/App.tsx`).
   - Archivos compilados del frontend en `dist/` (por ejemplo, `dist/index.html` y bundles CSS/JS generados).
   - Este archivo de directivas `GEMINI.md`.
3. **Archivos a omitir:** No agregues archivos temporales de depuración, notas de pasos ni volcados de pantalla generados durante la sesión (como `scratch_*`, `all_card_steps*`, o ficheros `.json` de pruebas locales).
4. **Comandos secuenciales:**
   ```bash
   cmd.exe /c "git add src/App.tsx dist/ GEMINI.md"
   cmd.exe /c "git commit -m \"Mensaje del commit descriptivo\""
   cmd.exe /c "git push origin main"
   ```
