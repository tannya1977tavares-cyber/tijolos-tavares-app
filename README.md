# App Tijolos Tavares

App de pedidos, cargas, agenda, orçamentos e recibos da Tijolos Tavares.

## Como sai o APK

Cada vez que algo é enviado pro ramo `main`, o GitHub monta o APK sozinho
(aba **Actions**) e publica em **Releases**. Pra instalar, abra a página de
Releases no celular, baixe o `TijolosTavares.apk` e toque nele.

## O que tem dentro

- `www/` é o app (HTML, CSS e JavaScript).
- `native/` é o código Android que liga o app ao calendário do celular.
- `android-res/` são os ícones do app.
- O banco de dados fica no Supabase (projeto `tijolos-tavares-app`).
