import React from 'react'
import ChatInput from '../components/Chat'
import Companion3D from '../components/Companion3D'

const companion = () => {
  return (
    <div className=''>

      <div className='m-auto p-auto'>
         <Companion3D />
      </div>
      <ChatInput />

    </div>
  )
}

export default companion