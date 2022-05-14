# syntax=docker/dockerfile:1

FROM satantime/puppeteer-node:latest

ENV NODE_ENV="production"

WORKDIR /usr/src/shy

COPY . .

RUN apt-get update -y && apt-get install python ffmpeg -y
RUN npm install
RUN sh ./dl.sh

CMD ["npm", "start"]