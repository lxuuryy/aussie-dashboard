'use client'

import VisiwiseTracker from "../(components)/VisiwiseTracker" 
import PDFGenerator from "@/app/(components)/PDFGenerator"
import SMSSender from "@/app/(components)/SMSSender"




type Props = {}

const page = (props: Props) => {
  return (
    <div>
      
     <SMSSender />
     
    </div>
  )
}

export default page