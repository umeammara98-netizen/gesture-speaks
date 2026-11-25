# Gesture Speaks

Gesture Speaks is a student website for Pakistani Sign Language. It shows everyday signs in English and Urdu, with a picture beside each word. Press a picture and the sign plays.

You can also type a word from the list and see its English and Urdu name. A camera page is ready for later, when a trained model file is added. Until then, the camera cannot name a sign.

## How to open it

You need two programs running at the same time. Open two terminals in this folder.

**1. The account and camera server**

```
cd server
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

The first time, create the Python environment and install the requirements in `server/requirements.txt`.

**2. The website**

```
npm install
npm run dev
```

Then open the address the website prints, usually http://127.0.0.1:5173/

## Accounts

People sign up with a name, an email, and a password. Those accounts are saved in a small file on this computer: `server/gesture.db`. That file is not uploaded to Git.

The first admin account is created the first time the server starts:

- Email: `admin@admin.com`
- Password: `admin123`

Signing in as that person opens the accounts page. From there you can make someone an admin, or disable an account. A disabled person cannot sign in. You cannot disable your own account.

A normal sign-up opens the studio. A normal account cannot open the accounts page.

The password can be changed in `server/.env` before the admin account is created. After it exists, editing that file does not change the password. `server/.env` is not uploaded to Git. `server/.env.example` shows the same settings.

## What each part does

- Home, About, Sign in, and Sign up are the public pages.
- Studio is the signed-in page. It has the camera, a box for typing a word, and the list of common signs.
- Accounts is only for an admin.
- The word list, Urdu names, and picture links are in `src/data/signs.json`. The pictures and videos stay on the Pakistan Sign Language dictionary site. This project only stores the links.
- A Camera mark on a card means that word was in the training set. The camera still cannot name it until the model file is added.

The server folder checks email and password, keeps the account list, and is where the camera will send a short clip once the model file is in place. Put that file here, then restart the server: `server/models/word_transformer.pt`. The model file is not uploaded to Git.

## What is not in the project

- The website does not draw a sign from a typed sentence.
- It does not turn speech into a sign.
- It does not take payments.
- Google sign-in is not included.

A few words in the list have no matching picture in the public dictionary. Those cards say "No picture."
