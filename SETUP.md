# 🚀 Fase 0 — Setup del proyecto

Estos son los pasos para dejar el entorno andando de cero. Se hace una sola vez.

## 1. Copiar el `.env`

```bash
cp backend/.env.example backend/.env
```

Después abrí `backend/.env` y cambiá `SECRET_KEY` por algo random (podés generarlo en https://djecrety.ir/).

## 2. Crear el proyecto Django dentro del backend

```bash
docker run --rm -v "$(pwd)/backend:/app" -w /app python:3.12-slim bash -c "pip install django==5.1.4 && django-admin startproject config ."
```

Esto crea la carpeta `backend/config/` con el proyecto Django base y un `manage.py` en la raíz de `backend/`.

## 3. Crear el proyecto Angular dentro del frontend

```bash
docker run --rm -v "$(pwd)/frontend:/app" -w /app node:20-alpine sh -c "npm install -g @angular/cli && ng new kmsplit --directory=. --routing --style=scss --skip-git --defaults"
```

> **Nota:** en versiones recientes del Angular CLI no se puede usar `.` como nombre del proyecto — hay que darle un nombre (`kmsplit` en este caso) y dejar `--directory=.` para que igual instale en la carpeta actual.

Angular te va a preguntar algunas cosas (SSR, etc.) — para este proyecto conviene decir **que no** a Server-Side Rendering por ahora, no lo necesitás para el MVP.

## 4. Configurar Django para usar PostgreSQL

En `backend/config/settings.py`, reemplazar el bloque `DATABASES` por:

```python
from decouple import config

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB'),
        'USER': config('POSTGRES_USER'),
        'PASSWORD': config('POSTGRES_PASSWORD'),
        'HOST': config('POSTGRES_HOST'),
        'PORT': config('POSTGRES_PORT'),
    }
}
```

Y agregar en `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ...apps por defecto de Django...
    'rest_framework',
    'corsheaders',
    'accounts',
    'core',
]
```

Y en `MIDDLEWARE`, agregar arriba de todo:

```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    # ...el resto de middlewares que ya vienen por defecto...
]
```

Y al final del archivo:

```python
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS').split(',')
ALLOWED_HOSTS = config('ALLOWED_HOSTS').split(',')

AUTH_USER_MODEL = 'accounts.User'
```

## 5. Levantar todo

```bash
docker compose up --build
```

- Backend disponible en `http://localhost:8000`
- Frontend disponible en `http://localhost:4200`
- Postgres escuchando en `localhost:5432` (por si querés conectarte con DBeaver/TablePlus para inspeccionar)

## 6. Verificar que Django se conecta bien a Postgres

Con los contenedores corriendo, en otra terminal:

```bash
docker compose exec backend python manage.py migrate
```

Si no tira error de conexión, ya está todo enchufado correctamente.

## 7. Primer commit

```bash
git add .
git commit -m "Fase 0: setup de Docker Compose, Django y Angular"
git push
```

---

# 🐛 Troubleshooting (problemas reales encontrados)

Estos son problemas concretos que aparecieron al levantar el proyecto en Windows, documentados para no repetir la investigación:

**Docker no instalado / virtualización deshabilitada**
Docker Desktop en Windows necesita WSL2 y virtualización habilitada en la BIOS (modo SVM en AMD, VT-x en Intel). Si `docker` no corre, revisar eso primero.

**Rutas mal interpretadas en Git Bash (`-v` de docker run)**
Git Bash en Windows convierte automáticamente rutas tipo `/app` a rutas de Windows, lo que rompe los volúmenes de Docker. Solución: correr `export MSYS_NO_PATHCONV=1` antes de los comandos `docker run` con `-v`, o agregarlo al perfil de la terminal.

**`ng new .` ya no funciona**
Ver nota en el paso 3 — usar un nombre de proyecto real (`kmsplit`) + `--directory=.`.

**`ModuleNotFoundError: No module named 'decouple'`**
Pasa si el contenedor de backend se buildeó *antes* de que `python-decouple` estuviera en `requirements.txt`, y Docker usó caché de capas vieja. Solución: `docker compose build --no-cache backend`.

**`FATAL: database "kmsplit_user" does not exist`**
El healthcheck de Postgres necesita apuntar a la base específica, no solo al servidor:
```yaml
test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-kmsplit_user} -d ${POSTGRES_DB:-kmsplit}"]
```
Importante: Postgres solo corre el script de creación de la base **la primera vez** que el volumen de datos está vacío. Si ya levantaste el contenedor una vez con credenciales distintas, cambiar el `.env` después no alcanza — hay que borrar el volumen y dejar que se re-inicialice:
```bash
docker compose down -v
docker compose up --build
```

---

# 🧱 Fase 1 — Modelos y admin

## 1. Crear las apps de Django

```bash
docker compose exec backend python manage.py startapp accounts
docker compose exec backend python manage.py startapp core
```

## 2. Reemplazar `models.py` y `admin.py`

Copiar los archivos `accounts/models.py`, `accounts/admin.py`, `core/models.py` y `core/admin.py` de este paquete, pisando los que generó Django vacíos.

## 3. Registrar las apps y el modelo de usuario custom

Ya está incluido en el paso 4 de la Fase 0 de este mismo archivo (`INSTALLED_APPS` con `accounts` y `core`, y `AUTH_USER_MODEL = 'accounts.User'`). Si ya habías hecho el setup de Fase 0 antes, agregá esas líneas ahora.

> **Importante:** `AUTH_USER_MODEL` solo se puede definir **antes** de la primera migración. Si ya corriste `migrate` con el usuario default de Django, hay que borrar el volumen de Postgres (`docker compose down -v`) y arrancar de cero.

## 4. Generar y aplicar las migraciones

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

## 5. Crear un superusuario para entrar al admin

```bash
docker compose exec backend python manage.py createsuperuser
```

Te va a pedir email, nombre y contraseña (no username, porque el modelo custom no lo tiene).

## 6. Probar en el admin

Entrá a `http://localhost:8000/admin`, logueate, y cargá a mano:
- Un `Group` (tu familia)
- Vos como `GroupMembership` con rol `owner`
- El `Vehicle` (tu Fiesta)
- Algunos `Trip` y una `FuelLoad` con datos reales de tu Excel

Esto sirve para validar visualmente que el modelo tiene sentido antes de programar la lógica de liquidación automática.

## 7. Commit

```bash
git add .
git commit -m "Fase 1: modelos de negocio (accounts + core) y admin de Django"
git push
```
