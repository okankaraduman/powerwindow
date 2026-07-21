# Checklist para prueba cerrada de Android

## Web

- [x] Privacy page at `https://powerwindow.energy/privacy`
- [x] Wallbox demo claramente etiquetada como solo demostración
- [x] PWA manifest includes PNG icon
- [ ] Publicar `.well-known/assetlinks.json` con el SHA-256 real de Play App Signing
- [ ] Confirm Cloudflare Pages has deployed latest `main`

## Android

- [x] Gradle wrapper añadido
- [x] Recursos de icono adaptativo añadidos
- [x] Configuración de firma release añadida
- [x] Trusted Web Activity configurada
- [ ] Install Android Studio or Java + Android SDK
- [ ] Create release keystore
- [ ] Obtener SHA-256 de Play App Signing o del certificado release
- [ ] Copy `android/keystore.properties.example` to `android/keystore.properties`
- [ ] Build signed release bundle with `./gradlew bundleRelease`

## Google Play

- [x] Icono de tienda generado: `store/assets/icon-512.png`
- [x] Gráfico destacado generado: `store/assets/feature-graphic.png`
- [x] Capturas de teléfono generadas en `store/assets/screenshots/`
- [x] Borrador de ficha escrito en `store/play-store-listing.md`
- [x] Borrador de Seguridad de Datos escrito en `store/data-safety.md`
- [ ] Create app in Play Console
- [ ] Completar formularios de contenido de la app
- [ ] Añadir URL de política de privacidad
- [ ] Subir AAB firmado a prueba interna o cerrada
- [ ] En cuentas personales nuevas, reclutar 12 testers durante 14 días continuos
