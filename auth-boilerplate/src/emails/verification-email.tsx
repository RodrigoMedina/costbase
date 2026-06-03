import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

export interface VerificationEmailProps {
  email: string;
  userName?: string;
  verificationUrl: string;
  baseUrl?: string;
}

export const VerificationEmail = ({
  userName,
  verificationUrl,
}: VerificationEmailProps) => {
  const firstName = userName?.trim().split(" ")[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  return (
    <Html lang="en">
      <Head />
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-[#F9F9F9] font-sans">
          <Preview>Verify your email to get started</Preview>
          <Container className="max-w-[580px] my-[30px] mx-auto bg-white">
            <Section className="pt-[5px] px-5 pb-[10px]">
              <Text className="text-[14px] leading-[1.5]">{greeting}</Text>
              <Text className="text-[14px] leading-[1.5]">
                Thanks for signing up. Please verify your email address to activate your account:
              </Text>
              <Button
                href={verificationUrl}
                className="text-[14px] bg-[#007cba] text-white leading-normal rounded-lg py-3 px-6 box-border block text-center no-underline"
              >
                Verify Email Address
              </Button>
              <Text className="text-[14px] leading-[1.5] mt-4">
                If the button doesn&apos;t work, copy and paste this link:
                <br />
                <Link href={verificationUrl} className="text-[#007cba] underline break-all">
                  {verificationUrl}
                </Link>
              </Text>
              <Text className="text-[14px] leading-[1.5]">
                If you didn&apos;t create this account, you can safely ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default VerificationEmail;
