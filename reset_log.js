db.crawllogs.updateMany({type: 'duplicate_scan', status: 'running'}, {$set: {status: 'failed', errorMessages: ['Reset thủ công']}});
