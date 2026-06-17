# RoboTec Planner Korea 2026

Planner web mobile-first para el equipo RoboTec, publicado como sitio estatico en GitHub Pages y conectado a Google Sheets mediante Google Apps Script.

## Google Sheet

Base de datos:
https://docs.google.com/spreadsheets/d/1lqJ1MtkgVoC-e4hjU-SPqeUIGplV_4NemF8dXv5uk_s/edit

Pestanas creadas:
- `Tasks`
- `People`
- `Config`
- `Changelog`

## Desplegar Apps Script

El conector disponible no expone despliegue automatico de Apps Script. Pasos manuales:

1. Abre https://script.google.com/.
2. Crea un proyecto nuevo llamado `Robotec Planner API`.
3. Pega el contenido de `apps-script/Code.gs`.
4. En `Project Settings`, agrega una script property:
   - `TEAM_CODE`: el codigo simple del equipo.
5. En `Deploy > New deployment`, elige `Web app`.
6. Configura:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Copia la URL `/exec` del Web App.
8. Abre el planner y pega esa URL en el panel de conexion.

El codigo del equipo se valida en Apps Script; no hay secretos reales hardcodeados en el frontend. Cada vez que cambies `apps-script/Code.gs`, crea una nueva implementacion o actualiza la implementacion existente para que la URL `/exec` use el codigo mas reciente.
