npx pm2 kill \
&& npx tsc \
&& npx pm2 start app/index.js --name shy --restart-delay 5000 -f \
&& npx pm2 logs