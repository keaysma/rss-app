# RSS (Really Simple Syndication) Web App
I have seen a couple of RSS apps/tools in the wild. Some of them are paid, other not. All of the free ones require you to download something, one was a browser extension.

I see a simpler avenue: Let's just make a website that has all of the features of an RSS client. Among the chief features of a client is the ability to aggregate articles on a scheduled basis from your selected feeds or aggregators. You can do that on the web using a Service Worker. It is nice if the application is able to give you notifications about new articles, and also remember which ones you read and which ones you favorited. Notifications can be done using, again, Service Workers, but also using Web Push Notifications under the VAPID system. As for application memory, I see this as a chance for me to toy around with SQLite in the browser. Not really necessary, simpler solutions like localStorage exist, but, this is for education.

Also, sometimes it actually is nice to have a separate application. For that, the web app will have a PWA configuration.

Not sure how to handle sharing feed configurations yet. Something like Inoreader is nice because it can move seamlessly to another device. Atproto PDS could be used for this, but, that does sacrafice all privacy.

## What I want to build
- Syndication on an timer interval
- "Memory"
    - Remembering read, favorites
    - Other bells & whistles like tags, folders
- Web & push notifications
- PWA

## Things to think about
- Handling password-protected feeds?
- Moving configurations between devices?
- People like search, I haven't cared for it, but, something to think about
- Not-so-simple Synication, things like insta, youtube, etc. Out of scope for a little project

## What exists in the wild today
Feedbro
- Using this, it's nice
- Is an extension, took a little while to find it

Inoreader
- Requires login, I want this product to just work right away
- Free and paid tiers
- Stores data online
- Push notifications is a paid feature, OOF
