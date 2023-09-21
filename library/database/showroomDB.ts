/* eslint-disable no-console */
import mongoose, { Schema } from 'mongoose'

console.log('Connecting Showroom Database...')
const connection = mongoose.createConnection(process.env.MONGODB_URI_JKT48_SHOWROOM ?? '')
connection.on('connect', () => {
  console.log('Showroom DB connected!')
})

const stageListSchema = new Schema<Database.IStageListItem>({
  data_id: {
    type: String,
    unique: true,
  },
  stage_list: {
    type: [
      {
        _id: false,
        date: Date,
        list: [Number],
      },
    ],
    default: [],
  },
})

const StageList = connection.model('StageList', stageListSchema)
export { connection, StageList }
