import { Schema, model, Document } from 'mongoose';

export interface IAuditLog extends Document {
  entity: 'user' | 'contact' | 'company' | 'lead' | 'deal';
  entity_id: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'assigned';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  performed_by: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  entity: {
    type: String,
    enum: ['user', 'contact', 'company', 'lead', 'deal'],
    required: true,
  },
  entity_id:    { type: String, required: true },
  action: {
    type: String,
    enum: ['created', 'updated', 'deleted', 'status_changed', 'assigned'],
    required: true,
  },
  before:       { type: Schema.Types.Mixed },
  after:        { type: Schema.Types.Mixed },
  performed_by: { type: String, required: true },
  ip_address:   { type: String },
  user_agent:   { type: String },
  timestamp:    { type: Date, required: true, default: Date.now },
});

AuditLogSchema.index({ entity: 1, entity_id: 1 });
AuditLogSchema.index({ performed_by: 1 });
AuditLogSchema.index({ timestamp: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);