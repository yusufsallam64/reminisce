by Yusuf Sallam and [Safa Karagoz](https://github.com/Safa-Karagoz)

## What is this?
This project was created as our submission for HackRU 2024, Rutgers University's annual hackathon. Our project aims to support individuals suffering from dementia predominantly through active recall and "companionship."

## Project Structure
There are two predominant models utilized in this project:
- Contextualized LLM Model (model-agnostic)
- ElevenLabs Text-to-Speech

For the production version of this project, we are utilizing [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) with Meta's llama-3-8b-instruct model. Other models will likely function similarly; the only requirement is distinguishing system, assistant, and user commands within the conversation. This portion is given context regarding the patient's background and history (questions at `/src/data/companionQuestions.json`). This allows the model to assist the patient with recalling their lives accurately. In tests, the model has demonstrated the capability to identify when a patient forgets their own identity and informs them who they are.

For our text-to-speech function, we utilize [ElevenLabs' voice replication models](https://elevenlabs.io/text-to-speech). Patients with dementia and other memory-related deficiencies have historically demonstrated improvements in recall rates when provided with stronger emotional stimuli. With this project, we replicate the voice of a loved one or caretaker to enhance the auditory stimulus of our project with the overarching goal of achieving greater emotional stimulus, making it easier for patients to remember. We then take the output from our contextualized LLM and output audible feedback using our audio model. 

For speech-to-text processing, we utilize SpeechRecognition provided through the Web Speech API.

## Running the Project Locally
To run this project, set the following environment variables:
- `MONGODB_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_LLM_MODEL`
- `NEXT_PUBLIC_ELEVENLABS_API_KEY`

To run using TurboPack, `npm run devt`. Otherwise, `npm run dev`

This project was awarded 2nd place for the NeuroTech track at [HackRU 2024](https://hackru-fall-2024.devpost.com). 

[Check out our Devpost!](https://devpost.com/software/reminisce-er4lyh?ref_content=my-projects-tab&ref_feature=my_projects)
