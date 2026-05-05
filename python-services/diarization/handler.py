"""AWS Lambda handler for child-adult speaker diarization."""
import json
import logging
import traceback

from classifier import classify_speakers

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    logger.info('Event received: %s speakers', len(event.get('speakers', [])))
    try:
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        speakers = event['speakers']

        if not speakers:
            return {'error': 'No speakers provided'}

        results = classify_speakers(s3_bucket, s3_key, speakers)
        logger.info('Results: %s', results)
        return results

    except Exception:
        logger.error('Unhandled error:\n%s', traceback.format_exc())
        return {'error': traceback.format_exc().splitlines()[-1]}
