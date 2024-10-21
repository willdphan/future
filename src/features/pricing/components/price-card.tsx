'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { IoCheckmark } from 'react-icons/io5';

import { Button } from '@/app/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

import { PriceCardVariant, productMetadataSchema } from '../models/product-metadata';
import { BillingInterval, Price, ProductWithPrices } from '../types';

export function PricingCard({
  product,
  price,
  createCheckoutAction,
}: {
  product: ProductWithPrices;
  price?: Price;
  createCheckoutAction?: ({ price }: { price: Price }) => void;
}) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    price ? (price.interval as BillingInterval) : 'month'
  );

  // Determine the price to render
  const currentPrice = useMemo(() => {
    if (price) return price;
    if (product.prices.length === 0) return null;
    if (product.prices.length === 1) return product.prices[0];
    return product.prices.find((price) => price.interval === billingInterval);
  }, [billingInterval, price, product.prices]);

  const monthPrice = product.prices.find((price) => price.interval === 'month')?.unit_amount;
  const yearPrice = product.prices.find((price) => price.interval === 'year')?.unit_amount;
  const isBillingIntervalYearly = billingInterval === 'year';
  const metadata = productMetadataSchema.parse(product.metadata);
  const buttonVariantMap = {
    basic: 'default',
    pro: 'sexy',
    enterprise: 'orange',
  } as const;

  function handleBillingIntervalChange(billingInterval: BillingInterval) {
    setBillingInterval(billingInterval);
  }

  return (
    <div className='max-h-screen min-h-screen w-full flex-1'>
      <div className='flex w-full flex-col rounded-md border border-[#C2BEB5] bg-white p-4 transition-none hover:border-[#C2BEB5] hover:shadow-none lg:p-8'>
        <div className='p-4'>
          <div className='mb-1 text-center font-man text-xl font-bold text-[#3C3C3C]'>{product.name}</div>
          <div className='flex justify-center gap-0.5 font-ibm text-[#3C3C3C]'>
            <span className='text-2xl font-semibold'>
              {yearPrice && isBillingIntervalYearly
                ? '$' + yearPrice / 100
                : monthPrice
                ? '$' + monthPrice / 100
                : 'Custom'}
            </span>
            <span className='self-end'>
              {yearPrice && isBillingIntervalYearly ? '/year' : monthPrice ? '/month' : null}
            </span>
          </div>
        </div>

        {!Boolean(price) && product.prices.length > 1 && <PricingSwitch onChange={handleBillingIntervalChange} />}

        <div className='m-auto flex w-fit flex-1 flex-col gap-2 px-8 py-4'>
          {metadata.generatedImages === 'enterprise' && <CheckItem text={`Unlimited banner images`} />}
          {metadata.generatedImages !== 'enterprise' && (
            <CheckItem text={`Generate ${metadata.generatedImages} banner images`} />
          )}
          {<CheckItem text={`${metadata.imageEditor} image editing features`} />}
          {<CheckItem text={`${metadata.supportLevel} support`} />}
        </div>

        {createCheckoutAction && (
          <div className='py-3'>
            {currentPrice && (
              <Button
                variant='default' // Use a consistent variant
                className='w-full border-2 border-black bg-[#00B7FC] font-man text-black hover:bg-[#00B7FC] hover:no-underline'
                onClick={() => createCheckoutAction({ price: currentPrice })}
              >
                Get Started
              </Button>
            )}
            {!currentPrice && (
              <Button
                variant='default' // Use a consistent variant
                className='w-full bg-[#00B7FC] text-white hover:bg-[#00B7FC] hover:no-underline '
                asChild
              >
                <Link href='/contact'>Contact Us</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className='flex items-center gap-2 pt-2'>
      <IoCheckmark className='my-auto flex-shrink-0 text-[#3C3C3C]' />
      <p className='font-man text-sm text-[#3C3C3C] first-letter:capitalize'>{text}</p>
    </div>
  );
}

function PricingSwitch({ onChange }: { onChange: (interval: BillingInterval) => void }) {
  return (
    <Tabs defaultValue='month' className='w-full' onValueChange={(value) => onChange(value as BillingInterval)}>
      <TabsList className='my-2 grid w-full grid-cols-2 border-[1px] border-black bg-[#E8E4DB]'>
        <TabsTrigger
          value='month'
          className='font-ibm data-[state=active]:bg-[#3C3C3C] data-[state=inactive]:bg-[#E8E4DB] data-[state=active]:text-[#E8E4DB] data-[state=inactive]:text-[#3C3C3C]'
        >
          MONTHLY
        </TabsTrigger>
        <TabsTrigger
          value='year'
          className='font-ibm data-[state=active]:bg-[#3C3C3C] data-[state=inactive]:bg-[#E8E4DB] data-[state=active]:text-[#E8E4DB] data-[state=inactive]:text-[#3C3C3C]'
        >
          YEARLY
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
