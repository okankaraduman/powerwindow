# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Power Window helps people find lower-price hours for flexible electricity use in Spain, using hourly PVPC data from Red Eléctrica. The website, installed PWA, and Android Trusted Web Activity share the web interface. The SwiftUI sketch is parked (README.md).

## Users

Repository-supported audience: households in Spain planning appliances and EV charging, in Spanish or English. Relative priority between these audiences remains open; the redesign supports both.

## Capabilities and Constraints

Appliance/duration/day planning, EV battery and charge-target estimation, locally saved setups, editable bill assumptions, reminders, PWA installation, tariff comparison, historical statistics, and explanatory guides. Preserve existing data calculations and bilingual routes. Prices and estimates are not complete household bills. All unavailable or demonstration price data must retain truthful labels.

## Confirmed Direction

The user requested improved navigation and usability across the app and website. The user considers the demo unhelpful until a real integration is connected. Remove the synthetic walkthrough and demo charger controls from the interface; retain EV timing calculations. Backend connector infrastructure remains available for later integration.

## Evidence on Hand

README.md, data/catalog.mjs, shared/daily-market.mjs, existing Spanish and English page content, and the REE data client. Do not invent usage claims, integration capabilities, endorsements, or new price facts.
