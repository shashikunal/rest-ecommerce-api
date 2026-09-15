export {
  createKafkaClient,
  createProducer,
  createConsumer,
  closeKafka,
  closeProducer,
  closeConsumer,
  getKafkaClient,
  getProducer,
  getConsumer,
  isKafkaConnected,
} from '../../config/kafka';
export type { KafkaTopicConfig } from '../../config/kafka';
