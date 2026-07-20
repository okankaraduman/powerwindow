# Borrador de Seguridad de Datos de Google Play

Este es un borrador para Play Console. Revísalo antes de enviarlo.

## Datos recogidos

### Actividad en la app
Se recoge: Sí

Ejemplos:
- Los ajustes del planificador, como consumo seleccionado, duración y supuestos de coste, se guardan localmente.
- Los planes del cargador demo y los registros de comandos se guardan en el backend cuando se usa el conector demo.
- Si el usuario permite la analítica, Google Analytics mide vistas de página y patrones básicos de interacción con la app.

Finalidad:
- Funcionalidad de la app.
- Analítica y mejora del producto.
- Soporte del comportamiento del conector demo.

Compartido:
- No se venden datos.
- Cloudflare actúa como proveedor de alojamiento e infraestructura.
- Google actúa como proveedor de analítica solo después de que el usuario permita la medición.

### Información personal
Se recoge: No se recoge nombre de cuenta, correo electrónico, teléfono ni dirección en la versión actual.

### Ubicación
Se recoge: No se solicita permiso de ubicación precisa ni aproximada.

### Información financiera
Se recoge: No se recoge tarjeta de pago, cuenta bancaria, crédito ni historial de compras.

### Dispositivo u otros identificadores
Se recoge: La app crea un ID aleatorio en almacenamiento local para el estado del conector demo. Si se permite la analítica, Google Analytics puede usar identificadores de app o navegador para medición. La app no usa el ID de publicidad de Android.

Finalidad:
- Funcionalidad de la app.
- Analítica.

## Prácticas de seguridad

- Los datos se cifran en tránsito mediante HTTPS.
- Los usuarios pueden solicitar la eliminación de registros del conector demo en privacy@powerwindow.energy.
- La versión actual no guarda credenciales reales de coche ni cargador.

## Notas antes del envío

- Confirmar que privacy@powerwindow.energy está activo antes de publicar.
- Si más adelante se añaden conectores reales de cargadores, actualizar Seguridad de Datos para credenciales, tokens OAuth, estado de dispositivos e historial de comandos.
- Confirmar las clasificaciones finales de Google Analytics y Play Console antes de la publicación en producción.
