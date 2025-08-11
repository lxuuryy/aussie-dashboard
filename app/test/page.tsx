'use client'

import VisiwiseTracker from "../(components)/VisiwiseTracker" 
import PDFGenerator from "@/app/(components)/PDFGenerator"
import SMSSender from "@/app/(components)/SMSSender"
import MyOrdersPage from "@/app/(components)/MyOrdersPage"
import VisiwiseTestTracker from "../(components)/VisiwiseTestTracker"




type Props = {}

const page = (props: Props) => {
  return (
    <div>
      
    <VisiwiseTestTracker />
     
    </div>
  )
}

export default page