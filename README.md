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
- [ ] Support WA (Not bot, using user account)
- [ ] ~~Advance web media player (video.js)~~ (Default video player just more than enough)


## Installation
### Local host
1. `npm install`
2. Put your telegram bot token on `config.env`
3. `npm start`  
    ```
   Maybe you need to pass listening port on browser's address bar
   Example: 
       https://10.10.10.6/?w=OOP-112-720p.mp4
       -> https://10.10.10.6:8000/?w=OOP-112-720p.mp4
   ```
