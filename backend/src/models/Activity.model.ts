export interface IActivity extends Document {
    type: 'call' | 'email' | 'meeting' | 'note' | 'task';
    entity_type: 'contact' | 'lead' | 'deal';
    entity_id: string;
    performed_by: string;
    performed_at: Date;
    subject?: string;
    description?: string;
    duration?: number;
    outcome?: string;
    recording_url?: string;
    body?: string;
    attachments?: { name: string; url: string; size?: number }[];
    location?: string;
    attendees?: string[];
    agenda?: string;
    due_date?: Date;
    completed?: boolean;
    completed_at?: Date;
}

const ActivitySchema = new Schema<IActivity>(
    {
        type: {
        type: String,
        enum: ['call', 'email', 'meeting', 'note', 'task'],
        required: true,
        },
        entity_type: {
        type: String,
        enum: ['contact', 'lead', 'deal'],
        required: true,
        },
        entity_id:    { type: String, required: true },
        performed_by: { type: String, required: true },
        performed_at: { type: Date, required: true, default: Date.now },
        subject:      { type: String },
        description:  { type: String },
        duration:       { type: Number },
        outcome:        { type: String },
        recording_url:  { type: String },
        body:           { type: String },
        attachments:    [{ name: String, url: String, size: Number }],
        location:       { type: String },
        attendees:      [{ type: String }],
        agenda:         { type: String },
        due_date:       { type: Date },
        completed:      { type: Boolean },
        completed_at:   { type: Date },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

ActivitySchema.index({ entity_type: 1, entity_id: 1 });
ActivitySchema.index({ performed_by: 1 });
ActivitySchema.index({ performed_at: -1 });

export const Activity = model<IActivity>('Activity', ActivitySchema);