FROM node:latest
WORKDIR /usr/src
RUN mkdir /usr/src/config

COPY *.js /usr/src/
COPY *.json /usr/src/
RUN npm install

# map your configs
VOLUME /usr/src/config

CMD [ "node", "index.js"]
