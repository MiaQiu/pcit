"""AWS Lambda handler for Kintsugi DAM depression/anxiety screening."""
import logging
import traceback

from classifier import run_dam

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    logger.info('Event received: bucket=%s key=%s', event.get('s3_bucket'), event.get('s3_key'))
    try:
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        quantize = event.get('quantize', True)

        result = run_dam(s3_bucket, s3_key, quantize=quantize)
        logger.info('Result: %s', result)
        return result

    except Exception:
        logger.error('Unhandled error:\n%s', traceback.format_exc())
        return {'error': traceback.format_exc().splitlines()[-1]}
