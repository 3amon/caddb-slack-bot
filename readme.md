# About
This is a simple bot that sits in a slack channel and will look up card information for either Android: Netrunner and A Game of Thrones (depending on configuration).

# Usage
1. From this project's directory type: npm install
2. Add a slack bot to your server.
3. Edit the config.json file to point at either website and add your slack bot's API key.
4. From this project's directory type: node app.js

# Todo
* Add ability to use multiple websites. (netrunnerdb.com, thronesdb.com)
* Add a better channel message (than just linking to the card's picture).
* Better fuzzy search. Prioritize acronyms.

# License
Copyright (c) 2016 Eamon White Licensed under the MIT license.