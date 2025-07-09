import React from 'react'
import AddOrderComponent from './AddOrderComponent'

type Props = {}

const page = (props: Props) => {
  return (
    <div className='w-full h-full flex items-center justify-center pt-[100px]'>
        <AddOrderComponent />
    </div>
  )
}

export default page