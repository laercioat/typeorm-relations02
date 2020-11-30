import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import { AdvancedConsoleLogger } from 'typeorm';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Customer not found!');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );
    if (!existentProducts.length) {
      throw new AppError('No products found!');
    }
    const existentProductsIds = existentProducts.map(product => product.id);
    console.log(existentProducts);
    const inexistentProductsIds = products.filter(
      product => !existentProductsIds.includes(product.id),
    );
    if (inexistentProductsIds.length) {
      throw new AppError(`Could not find product: ${inexistentProductsIds} `);
    }

    const productsWithNoQuantitiesAvailable = products.filter(product =>
      existentProducts.find(
        existentProduct =>
          existentProduct.id === product.id &&
          existentProduct.quantity < product.quantity,
      ),
    );

    if (productsWithNoQuantitiesAvailable.length) {
      throw new AppError(
        `No quantity enough to products ${productsWithNoQuantitiesAvailable.map(
          product => product.id,
        )}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      // price: existentProducts.filter(existentProduct => existentProduct.id === product.id)[0].price,
      price:
        existentProducts.find(
          existentProduct => existentProduct.id === product.id,
        )?.price || 0,
      quantity: product.quantity,
    }));
    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const newProductsQuantities = products.map(product => ({
      id: product.id,
      quantity:
        (existentProducts.find(
          existentProduct => existentProduct.id === product.id,
        )?.quantity || 0) - product.quantity,
    }));

    const newProducts = await this.productsRepository.updateQuantity(
      newProductsQuantities,
    );
    console.log(newProducts);
    return order;
  }
}

export default CreateOrderService;
