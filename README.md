# ShyLook
Telegram/WA bot to download video using youtube-dl

Currently, I code this bot specifically to be hosted on `railway`  

## Features
- [x] Video downloader
  - [x] Select resolution/quality 
  - [x] Stream video on web server
  - [x] Download video directly from server
- [x] Audio downloader
- [ ] ~~Direct video downloader~~ (No need to mirror since it __direct__)
- [x] Support telegram bot
- [x] Support WA (Not bot, using user account)
- [ ] ~~Advance web media player (video.js)~~ (Default video player just more than enough)

## Commands
### Telegram Bot
- Just send a video link and bot will do the rest  

### Whatsapp Bot
- `!link VIDEO_LINK` -> Parse video link  
- `!cancel` -> Cancel your task  


## Installation
### Local host
1. Install all dependencies `npm install`
2. Put your telegram bot token on `config.env`
3. Start bot `npm start`  
    ```
   Maybe you need to pass listening port on browser's address bar
   Example: 
       https://10.10.10.6/?w=OOP-112-720p.mp4
       Should be -> https://10.10.10.6:8000/?w=OOP-112-720p.mp4
   ```

### Railway
1. Install [railway CLI](https://docs.railway.app/develop/cli)
2. Login `railway login --browserless`
3. Link your project `railway link`
4. Put your telegram bot token on `config.env`
5. Deploy `railway up`

#### How To Authenticate Whatsapp Bot
After successfully run your bot, you should get message like `[WA] GO TO /qrcode TO BLABLABLA`  
That's mean, you should go to `http://YOUR_HOST/qrcode`, then you will get the qrcode. Scan that QR using WA.  
If the authentication is success, message `[WA] AUTHENTICATED` should appear, else if not.  
Bot will save your session, so you don't need to re-authenticate. else if you redeploy it at any case.  