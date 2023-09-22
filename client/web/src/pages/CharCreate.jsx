/**
 * src/pages/CharCreate.jsx
 *
 * created by kivinju on 8/7/23
 */

import React, { useState, useEffect } from 'react';
import {
  Avatar,
  Button,
  TextareaAutosize,
  RadioGroup,
  FormControlLabel,
  Radio,
  Tooltip,
  IconButton,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  uploadfile,
  createCharacter,
  editCharacter,
  generateSystemPrompt,
  cloneVoice,
} from '../utils/apiUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import { analytics } from '../utils/firebase';
import { logEvent } from 'firebase/analytics';
import { GenerationEditor } from '@avatechai/avatars/react';
import lz from 'lz-string';
import queryString from 'query-string';
import { getHostName } from '../utils/urlUtils';

const user_prompt = `
Context
  ---
  {context}
  ---
  Use previous information as context to answer the following user question, Aim to keep responses super super concise and meaningful and try to express emotions.
  ALWAYS ask clarification question, when
  - user's question isn't clear
  - seems unfinished
  - seems totally irrelevant
  Remember to prefix your reply.
  ---
  {query}
`;

const CharCreate = ({ token, setSelectedCharacter }) => {
  const navigate = useNavigate();
  const [image, setImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState();
  const [formData, setFormData] = useState({
    name: '',
    system_prompt: '',
    user_prompt: user_prompt,
    tts: 'ELEVEN_LABS',
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Male: ErXwobaYiN019PkySvjV Female:EXAVITQu4vr4xnSDxMaL
    avatar_id: '', // Optional: The avatar id is generated by Labs - labs.avatech.ai
    visibility: 'private',
  });
  const [files, setFiles] = useState([]);
  const [voiceFiles, setVoiceFiles] = useState([]);
  const [warningMsg, setWarningMsg] = useState('');
  const [useCloneVoice, setUseCloneVoice] = useState(false);
  const [voiceCloneWarningMsg, setVoiceCloneWarningMsg] = useState('');
  const [voiceCloneStatusMsg, setVoiceCloneStatusMsg] = useState('');

  const [background, setBackground] = useState('');

  const { search } = useLocation();
  const { character = '' } = queryString.parse(search);

  useEffect(() => {
    const selectedCharacter = JSON.parse(
      lz.decompressFromEncodedURIComponent(character)
    );
    setSelectedCharacter(selectedCharacter);
    console.log('selectedCharacter', selectedCharacter);
    if (selectedCharacter) {
      const fetchCharacterFormData = async () => {
        try {
          const scheme = window.location.protocol;
          const url =
            scheme +
            '//' +
            getHostName() +
            `/characters/${selectedCharacter.character_id}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          setFormData({
            name: data.name || '',
            system_prompt: data.llm_system_prompt || '',
            user_prompt: data.llm_user_prompt || user_prompt, // Use user_prompt from props or state if it doesn’t exist on selectedCharacter
            tts: data.tts || 'ELEVEN_LABS',
            voice_id: data.voice_id || 'EXAVITQu4vr4xnSDxMaL',
            avatar_id: data?.avatar_id || '',
            visibility: data.visibility || 'private',
          });
        } catch (error) {
          console.error('There was an error fetching the data', error);
        }
      };
      fetchCharacterFormData();
    }
  }, [setSelectedCharacter, character, navigate]);

  const handleFileSelect = event => {
    setWarningMsg('');
    const selectedFiles = event.target.files;
    const selectedFilesArray = Array.from(selectedFiles);

    const fileTypesAllowed = ['text/plain', 'text/csv', 'application/pdf'];

    for (let i = 0; i < selectedFilesArray.length; i++) {
      if (!fileTypesAllowed.includes(selectedFilesArray[i].type)) {
        setWarningMsg('Only .txt, .csv, .pdf files are allowed');
        return;
      }
      if (selectedFilesArray[i].size > 5000000) {
        setWarningMsg('File size should be less than 5MB');
        return;
      }
    }

    if (files.length + selectedFilesArray.length > 5) {
      setWarningMsg('Max 5 files are allowed');
      return;
    }
    setFiles(prevFiles => [...prevFiles, ...selectedFilesArray]);
  };
  const handleDeleteFile = filename => {
    setFiles(prevFiles => prevFiles.filter(file => file.name !== filename));
  };

  const handleVoiceFileSelect = event => {
    setWarningMsg('');
    const selectedVoiceFiles = event.target.files;
    const selectedVoiceFilesArray = Array.from(selectedVoiceFiles);

    const fileTypesAllowed = [
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/x-m4a',
    ];

    for (let i = 0; i < selectedVoiceFilesArray.length; i++) {
      if (!fileTypesAllowed.includes(selectedVoiceFilesArray[i].type)) {
        setVoiceCloneWarningMsg('Only .wav, .mp3, .m4a files are allowed');
        return;
      }
      if (selectedVoiceFilesArray[i].size > 5000000) {
        setVoiceCloneWarningMsg('File size should be less than 5MB');
        return;
      }
    }

    if (files.length + selectedVoiceFilesArray.length > 5) {
      setVoiceCloneWarningMsg('Max 5 files are allowed');
      return;
    }
    setVoiceFiles(prevFiles => [...prevFiles, ...selectedVoiceFilesArray]);
    setVoiceCloneStatusMsg('Voice file(s) selected');
  };

  const handleChange = event => {
    if (event.target.name === 'voice_id') {
      if (event.target.value === 'placeholder') {
        setUseCloneVoice(true);
      } else {
        setUseCloneVoice(false);
      }
    }
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleBackgroundChange = event => {
    setBackground(event.target.value);
  };

  const onImageChange = event => {
    if (event.target.files && event.target.files.length > 0) {
      setImage(URL.createObjectURL(event.target.files[0]));
      setSelectedFile(event.target.files[0]);
    }
  };

  const autoGenerate = async () => {
    if (formData.name === '') {
      alert('Please enter a name');
      return;
    }
    let pre_prompt = formData.system_prompt;
    try {
      setFormData({ ...formData, system_prompt: 'Generating...' });
      let res = await generateSystemPrompt(formData.name, background, token);
      setFormData({ ...formData, system_prompt: res.system_prompt });
    } catch (error) {
      console.error(error);
      alert('Error generating system prompt');
      setFormData({ ...formData, system_prompt: pre_prompt });
    }
  };

  const cloneNewVoice = async () => {
    if (voiceFiles.length === 0) {
      alert('Please select a voice file');
      return;
    }
    setVoiceCloneStatusMsg('Cloning voice...');

    const voice_id = (await cloneVoice(voiceFiles, token))['voice_id'];

    setFormData({ ...formData, voice_id: voice_id });
    setVoiceCloneStatusMsg('Voice clone succeeded! Voice ID: ' + voice_id);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!formData.name) {
      alert('Please enter a name');
      return;
    }
    let new_formData = { ...formData };
    if (!new_formData.data) {
      new_formData.data = {};
    }
    // upload image to gcs
    if (image) {
      try {
        let res = await uploadfile(selectedFile, token);
        new_formData.data.avatar_filename = res.filename;
      } catch (error) {
        console.error(error);
        alert('Error uploading image');
      }
    }

    // upload files to gcs
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        try {
          let res = await uploadfile(files[i], token);
          new_formData.data[files[i].name] = res.filename;
        } catch (error) {
          console.error(error);
          alert('Error uploading files');
        }
      }
    }

    // call api to create or edit character
    console.log(new_formData);
    try {
      if (character) {
        await editCharacter(new_formData, token);
      } else {
        await createCharacter(new_formData, token);
      }
      navigate('/');
    } catch (error) {
      console.error(error);
      alert('Error creating character');
    }

    logEvent(analytics, 'create_character');
  };

  return (
    <div className='home'>
      <h1>Create a character</h1>
      <Avatar
        src={image}
        style={{ margin: '10px', width: '100px', height: '100px' }}
      />
      <input
        accept='image/*'
        style={{ display: 'none' }}
        id='raised-button-file'
        type='file'
        onChange={onImageChange}
      />
      <label htmlFor='raised-button-file'>
        <Button variant='contained' component='span'>
          Upload Avatar
        </Button>
      </label>

      <h2 style={{ alignSelf: 'flex-start' }}>Name</h2>
      <TextareaAutosize
        minRows={1}
        style={{ width: '100%', marginBottom: '20px' }}
        name='name'
        value={formData.name}
        onChange={handleChange}
        className='text-area'
      />

      <div className='md-align-self'>
        <GenerationEditor
          onAvatarIdLoaded={avatarId => {
            setFormData(formData => ({ ...formData, avatar_id: avatarId }));
          }}
        ></GenerationEditor>
      </div>

      <h2 style={{ alignSelf: 'flex-start' }}>Avatar Id</h2>

      <TextareaAutosize
        minRows={1}
        style={{ width: '100%' }}
        name='avatar_id'
        value={formData.avatar_id}
        onChange={handleChange}
        className='text-area'
      />
      <p
        style={{
          alignSelf: 'flex-start',
          fontStyle: 'italic',
          fontSize: '12px',
        }}
      >
        The avatar id is generated by&nbsp;
        <span
          style={{
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
          }}
          onClick={() => {
            window.open('https://labs.avatech.ai');
          }}
        >
          Labs - labs.avatech.ai
        </span>
      </p>

      <h2 style={{ alignSelf: 'flex-start' }}>Background</h2>
      <TextareaAutosize
        minRows={4}
        style={{ width: '100%' }}
        value={background}
        onChange={handleBackgroundChange}
        className='text-area'
      />
      <div style={{ alignSelf: 'flex-start' }}>
        <p>
          Choose up to 5 files related to your character. File types are limited
          to txt, csv, and pdf.
        </p>
        <input
          type='file'
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          id='select-files'
        />
        <label htmlFor='select-files'>
          <Button variant='contained' component='span'>
            Choose File to Upload (optional)
          </Button>
        </label>
        <p style={{ color: 'red' }}>{warningMsg}</p>
        <ul style={{ color: 'white' }}>
          {files.map(file => (
            <li key={file.name}>
              {file.name} &nbsp;
              <span onClick={() => handleDeleteFile(file.name)}>✖</span>
            </li>
          ))}
        </ul>
      </div>
      <h2 style={{ alignSelf: 'flex-start' }}>
        System Prompt (required)&nbsp;
        <Button variant='contained' component='span' onClick={autoGenerate}>
          Auto Generate
        </Button>
      </h2>
      <TextareaAutosize
        minRows={4}
        style={{ width: '100%', marginBottom: '20px' }}
        name='system_prompt'
        value={formData.system_prompt}
        onChange={handleChange}
        className='text-area'
      />
      <p>
        You can either auto-generate the prompt based on character name and
        background (it may take ~1 minute), or write the prompt yourself.
      </p>

      <h2 style={{ alignSelf: 'flex-start' }}>User Prompt</h2>
      <TextareaAutosize
        minRows={4}
        style={{ width: '100%', marginBottom: '20px' }}
        name='user_prompt'
        value={formData.user_prompt}
        onChange={handleChange}
        className='text-area'
      />

      <h2 style={{ alignSelf: 'flex-start' }}>Text-to-Speech Service</h2>
      <RadioGroup
        row
        name='tts'
        value={formData.tts}
        onChange={handleChange}
        style={{ alignSelf: 'flex-start' }}
      >
        <FormControlLabel
          value='ELEVEN_LABS'
          control={<Radio color='primary' />}
          label='Eleven Labs'
        />
        <FormControlLabel
          value='GOOGLE_TTS'
          control={<Radio color='primary' />}
          label='Google TTS'
        />
        <FormControlLabel
          value='UNREAL_SPEECH'
          control={<Radio color='primary' />}
          label='Unreal Speech'
        />
        <FormControlLabel
          value='EDGE_TTS'
          control={<Radio color='primary' />}
          label='Edge TTS'
        />
      </RadioGroup>

      <h2 style={{ alignSelf: 'flex-start' }}>Voice</h2>
      <RadioGroup
        row
        name='voice_id'
        value={formData.voice_id}
        onChange={handleChange}
        style={{ alignSelf: 'flex-start' }}
      >
        <FormControlLabel
          value={
            formData.tts === 'ELEVEN_LABS'
              ? 'EXAVITQu4vr4xnSDxMaL'
              : 'en-US-Studio-O'
          }
          control={<Radio color='primary' />}
          label='Female'
          disabled={
            formData.tts === 'UNREAL_SPEECH' || formData.tts == 'EDGE_TTS'
          }
        />
        <FormControlLabel
          value={
            formData.tts === 'ELEVEN_LABS'
              ? 'ErXwobaYiN019PkySvjV'
              : 'en-US-Studio-M'
          }
          control={<Radio color='primary' />}
          label='Male'
          disabled={
            formData.tts === 'UNREAL_SPEECH' || formData.tts == 'EDGE_TTS'
          }
        />
        <FormControlLabel
          value='placeholder'
          control={<Radio color='primary' />}
          label='Clone a new voice'
          disabled={formData.tts !== 'ELEVEN_LABS'}
        />
      </RadioGroup>

      {useCloneVoice && (
        <div className='home'>
          <input
            type='file'
            multiple
            style={{ display: 'none' }}
            onChange={handleVoiceFileSelect}
            id='select-voice-files'
          />
          <p style={{ color: 'red' }}>{voiceCloneWarningMsg}</p>
          <p style={{ color: 'green' }}>{voiceCloneStatusMsg}</p>
          <label htmlFor='select-voice-files'>
            <Button
              variant='contained'
              component='span'
              disabled={!useCloneVoice}
            >
              Choose File
            </Button>
          </label>
          <Button
            variant='contained'
            component='span'
            onClick={cloneNewVoice}
            disabled={!useCloneVoice}
          >
            Clone Voice
          </Button>
        </div>
      )}

      <h2 style={{ alignSelf: 'flex-start' }}>
        Visibility
        <Tooltip title='If set to public, the character will be visible to everyone after review.'>
          <IconButton>
            <InfoIcon color='primary' />
          </IconButton>
        </Tooltip>
      </h2>
      <RadioGroup
        row
        name='visibility'
        value={formData.visibility}
        onChange={handleChange}
        style={{ alignSelf: 'flex-start' }}
      >
        <FormControlLabel
          value='review'
          control={<Radio color='primary' />}
          label='Public'
        />
        <FormControlLabel
          value='private'
          control={<Radio color='primary' />}
          label='Private'
        />
      </RadioGroup>

      <Button variant='contained' color='primary' onClick={handleSubmit}>
        Submit
      </Button>
      <div>
        <p>It may take 30 seconds for the new character to be available.</p>
      </div>
    </div>
  );
};

export default CharCreate;
