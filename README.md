# KmSplit 🚗⛽

> Reparto justo del gasto de nafta en autos compartidos, proporcional a los km recorridos por cada persona.

## Descripción

KmSplit es una aplicación web mobile-first que resuelve un problema muy común en familias o grupos que comparten un mismo auto: **repartir el gasto de combustible de forma justa**, según cuánto manejó realmente cada persona, y no de forma equitativa a ciegas.

La app permite registrar los viajes diarios de cada conductor y las cargas de combustible, calculando automáticamente cuánto le corresponde pagar a cada integrante del grupo en base a los kilómetros recorridos entre carga y carga.

## Problema que resuelve

Cuando varias personas comparten un vehículo (por ejemplo, en una familia), es común que el gasto de nafta se divida en partes iguales sin importar quién usó más el auto. Esto genera injusticias y discusiones. Llevar este control a mano en una planilla de cálculo funciona, pero es incómodo, propenso a errores y difícil de mantener actualizado desde el celular.

KmSplit digitaliza y automatiza ese proceso, ofreciendo:

- Registro rápido de viajes desde el celular (mobile-first)
- Cálculo automático y transparente del reparto proporcional
- Historial y visualización clara del gasto de cada integrante
- Detección de kilómetros no asignados (viajes no registrados) para mantener la trazabilidad

## Funcionalidades (MVP)

- [ ] Registro y login de usuarios
- [ ] Creación de grupos (familia/convivientes) y vehículo asociado
- [ ] Carga de viajes diarios (usuario, km inicial, km final)
- [ ] Carga de combustible (fecha, km del odómetro, monto total)
- [ ] Cálculo automático de liquidación/reparto entre cargas
- [ ] Dashboard con historial y gráficos de gasto por persona
- [ ] Diseño responsive, mobile-first

## Stack tecnológico

**Backend:** Django + Django REST Framework, PostgreSQL
**Frontend:** Angular (standalone components), Html, Css, Tailwind CSS
**Diseño:** Figma
**Infraestructura:** Docker, Docker Compose
**Deploy:** Vercel

## 📂 Estructura del proyecto

```
kmsplit/
├── backend/          # API Django REST Framework
├── frontend/         # App Angular
├── docker-compose.yml
└── README.md
```
<!---
## Instalación y uso

> _Sección en construcción — se completará a medida que avance el desarrollo._

```bash
# clonar el repo
git clone https://github.com/tu-usuario/kmsplit.git

# instrucciones de backend y frontend próximamente
```
-->
## 📸 Capturas / Demo

> Se agregarán capturas de pantalla de todo el avance del proyecto, como los diagramas de fluyo, capturas de los wireframos y el modelo relacional de la base de datos en esta primera estapa.
> Link al Figma: https://www.figma.com/design/laSA5OAyx2tbP8l0ezerSE/KmSplit?node-id=0-1&t=eRqsWqXdQEigd7KL-1
> <img width="1239" height="331" alt="image" src="https://github.com/user-attachments/assets/4cfcc940-c68d-421c-ae1f-398d73609b13" />
> **Wireframes mobile-first**
> Login, Registro y Recuperar contraseña
> <img width="873" height="549" alt="image" src="https://github.com/user-attachments/assets/78a56cb6-f0da-4b63-b659-c335a4968b07" />
> Seleccion de vehículo, Menú del vehículo y Registrar viaje
> <img width="879" height="545" alt="image" src="https://github.com/user-attachments/assets/d72e5287-f259-4289-8776-a562b8c54896" />
> Registro de carga, Resumen y Historial semanal
> <img width="888" height="549" alt="image" src="https://github.com/user-attachments/assets/82c94691-b977-405a-b8fd-ab19e437fdc9" />


## Roadmap

- [x] Definición del proyecto y modelo de datos
- [x] Wireframes mobile-first
- [ ] Modelos y lógica de backend
- [ ] CRUD básico (viajes, cargas, grupos)
- [ ] Lógica de liquidación/reparto
- [ ] Frontend mobile-first
- [ ] Deploy
- [ ] Funcionalidades extra (invitar por link, exportar PDF, multi-vehículo)

## 👤 Autor

**Mariano** — Estudiante de la Tecnicatura Superior en Desarrollo de Software (TSDS), ISPC, Córdoba, Argentina.
Full Stack Developer Jr en formación | [LinkedIn](www.linkedin.com/in/mariano-casarino) | [Portfolio](https://github.com/marian-casa)

## 📄 Licencia

Este proyecto es de código abierto y fue creado con fines de portfolio y aprendizaje.
