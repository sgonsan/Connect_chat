#!/bin/bash

git pull

cd server && npm install && cd ..

cd client && npm install && npm run build && cd .. 

pm2 restart all