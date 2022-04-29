# syntax=docker/dockerfile:1

FROM satantime/puppeteer-node:latest

ENV NODE_ENV="production"

WORKDIR /shy

COPY . .

RUN apt-get update || : && apt-get install python -y
RUN npm install
RUN sh ./dl.sh

CMD ["npm", "start"]